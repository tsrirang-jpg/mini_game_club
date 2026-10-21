import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({create:vi.fn(),joinById:vi.fn(),reconnect:vi.fn()}));
vi.mock('@colyseus/sdk', () => ({Client:class {create=sdk.create;joinById=sdk.joinById;reconnect=sdk.reconnect;}}));
const storage=new Map<string,string>();
function room() {
  const signals:Record<string, (...args: any[])=>void>={};
  const messages:Record<string, (...args: any[])=>void>={};
  let pong:()=>void=()=>{};
  const reconnect=vi.fn();
  const value={roomId:'ABCDEF0123',sessionId:'p0',reconnectionToken:'private-token',reconnection:{enabled:true,minUptime:0,maxRetries:0,maxEnqueuedMessages:0},
    connection:{isOpen:true,reconnect,close:vi.fn()},send:vi.fn(),leave:vi.fn(async()=>1000),
    ping:vi.fn((callback:()=>void)=>{pong=callback;}),
    onMessage:vi.fn((name:string,callback:(...args:any[])=>void)=>{messages[name]=callback;}),onError:vi.fn(),onDrop:(f:()=>void)=>signals.drop=f,onReconnect:(f:()=>void)=>signals.reconnect=f,onLeave:(f:()=>void)=>signals.leave=f};
  return {value,signals,messages,reconnect,pong:()=>pong()};
}
function pending<T>() {let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};}
beforeEach(()=>{
  vi.resetModules();vi.useFakeTimers();vi.clearAllMocks();storage.clear();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
  vi.stubGlobal('location',{protocol:'http:',host:'localhost',pathname:'/rooms/create',search:''});
  vi.stubGlobal('history',{pushState:vi.fn(),replaceState:vi.fn()});
  vi.stubGlobal('window',Object.assign(new EventTarget(),{scrollTo:vi.fn()}));
  vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));
  vi.stubGlobal('navigator',{onLine:true});
});
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
describe('client session resource lifecycle',()=>{
 it('deduplicates create attempts and closes a connection that completes after cancellation',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room(),request=pending<typeof r.value>();sdk.create.mockReturnValue(request.promise);
  const first=s.connect('A');void s.connect('A');await vi.dynamicImportSettled();expect(sdk.create).toHaveBeenCalledTimes(1);
  s.leave('/games');request.resolve(r.value);await first;
  expect(r.value.reconnection.enabled).toBe(false);expect(r.value.connection.close).toHaveBeenCalledWith(1000);expect(s.getSnapshot().status).toBe('idle');expect(storage.size).toBe(0);
 });
 it('does not revive the token or send sync from a queued reconnect callback after leaving',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.signals.reconnect();s.leave('/games');await Promise.resolve();
  expect(s.getSnapshot()).toMatchObject({status:'idle',playerId:'',handRound:-1});expect(storage.size).toBe(0);expect(r.value.send).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
 });
 it('does not schedule another restore retry when an in-flight attempt fails after cancellation',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),request=pending<never>();sdk.reconnect.mockReturnValue(request.promise);storage.set('pok.session.v1','private-token');
  const restored=s.restore();void s.restore();await vi.dynamicImportSettled();expect(sdk.reconnect).toHaveBeenCalledTimes(1);
  s.leave('/games');request.reject(new Error('offline'));await restored;expect(vi.getTimerCount()).toBe(0);expect(storage.size).toBe(0);
 });
});

function visibility(hidden:boolean) {
  Object.assign(document,{hidden}); document.dispatchEvent(new Event('visibilitychange'));
}
async function flush() { await Promise.resolve(); vi.runAllTicks(); }
describe('mobile foreground recovery shared by every game',()=>{
 it.each(['pok','poker','spyfall','oldmaid','whoami','liar','undercover'])('resyncs %s only on return, preserving player/hand and waiting for a fresh pong',async kind=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(kind),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.messages.snapshot({code:r.value.roomId,roundId:3});r.messages.hand({roundId:3,cards:[{rank:7,suit:'hearts'}]});
  visibility(true);await vi.advanceTimersByTimeAsync(20_000);
  expect(r.value.ping).not.toHaveBeenCalled();expect(r.value.send).toHaveBeenCalledTimes(1);
  visibility(false);window.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));window.dispatchEvent(new Event('online'));
  expect(r.value.ping).toHaveBeenCalledTimes(1);expect(s.getSnapshot().status).toBe('reconnecting');
  r.messages.snapshot({code:r.value.roomId,roundId:3});expect(s.getSnapshot().status).toBe('reconnecting');
  r.pong();expect(r.value.send).toHaveBeenLastCalledWith('sync');r.messages.snapshot({code:r.value.roomId,roundId:3});
  expect(s.getSnapshot()).toMatchObject({status:'connected',playerId:'p0',handRound:3,hand:[{rank:7,suit:'hearts'}]});
  expect(r.reconnect).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);s.leave('/games');
 });
 it('gives a slow but responsive mobile connection a separate snapshot budget after its pong',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  visibility(true);visibility(false);await vi.advanceTimersByTimeAsync(1400);r.pong();await vi.advanceTimersByTimeAsync(2000);
  expect(r.value.connection.close).not.toHaveBeenCalled();r.messages.snapshot({code:r.value.roomId,roundId:0});
  expect(s.getSnapshot().status).toBe('connected');expect(vi.getTimerCount()).toBe(0);s.leave('/games');
 });
 it('detects a silently dead OPEN socket in 1.5s then bypasses backoff without duplicate sockets',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.value.connection.close.mockImplementation(code=>{if(code===4010){r.value.connection.isOpen=false;r.signals.drop();}});
  visibility(true);visibility(false);await vi.advanceTimersByTimeAsync(1499);expect(r.value.connection.close).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);await flush();expect(r.value.connection.close).toHaveBeenCalledWith(4010);expect(r.reconnect).toHaveBeenCalledTimes(1);
  // An old SDK backoff callback must not race an in-flight foreground attempt.
  r.value.connection.reconnect();expect(r.reconnect).toHaveBeenCalledTimes(1);
  r.value.connection.isOpen=true;r.signals.reconnect();await flush();r.messages.snapshot({code:r.value.roomId,roundId:0});
  expect(s.getSnapshot().status).toBe('connected');r.value.connection.reconnect();expect(r.reconnect).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);s.leave('/games');
 });
 it('waits while hidden/offline and immediately retries when internet returns',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  visibility(true);r.value.connection.isOpen=false;r.signals.drop();await flush();expect(r.reconnect).not.toHaveBeenCalled();
  Object.assign(navigator,{onLine:false});visibility(false);expect(r.reconnect).not.toHaveBeenCalled();
  Object.assign(navigator,{onLine:true});window.dispatchEvent(new Event('online'));expect(r.reconnect).toHaveBeenCalledTimes(1);s.leave('/games');
 });
 it('keeps SDK backoff after repeated failures instead of a tight immediate-retry loop',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.value.connection.isOpen=false;r.signals.drop();await flush();expect(r.reconnect).toHaveBeenCalledTimes(1);
  r.signals.drop();await flush();expect(r.reconnect).toHaveBeenCalledTimes(1);
  r.value.connection.reconnect();expect(r.reconnect).toHaveBeenCalledTimes(2);s.leave('/games');
 });
 it('retries an attempt stuck during handshake instead of waiting indefinitely',async()=>{
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.value.connection.isOpen=false;r.signals.drop();await flush();expect(r.reconnect).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(4000);expect(r.value.connection.close).toHaveBeenCalledWith(4010);s.leave('/games');
 });
 it('cleans up foreground listeners, late pongs and pending retries after leaving',async()=>{
  const removeDocument=vi.spyOn(document,'removeEventListener'),removeWindow=vi.spyOn(window,'removeEventListener');
  const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  visibility(true);visibility(false);s.leave('/games');r.pong();window.dispatchEvent(new Event('online'));visibility(true);visibility(false);r.value.connection.reconnect();
  expect(removeDocument).toHaveBeenCalledWith('visibilitychange',expect.any(Function));expect(removeWindow).toHaveBeenCalledWith('online',expect.any(Function));expect(removeWindow).toHaveBeenCalledWith('pageshow',expect.any(Function));
  expect(r.value.send).toHaveBeenCalledTimes(1);expect(r.reconnect).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);expect(storage.size).toBe(0);
 });
 it('disposes listeners when the server closes a room',async()=>{
  const remove=vi.spyOn(document,'removeEventListener');const {GameSession}=await import('../apps/client/src/session');const s=new GameSession(),r=room();sdk.create.mockResolvedValue(r.value);await s.connect('A');
  r.signals.leave(1000);visibility(true);visibility(false);expect(s.getSnapshot().status).toBe('idle');expect(remove).toHaveBeenCalledWith('visibilitychange',expect.any(Function));expect(r.value.ping).not.toHaveBeenCalled();
 });
});
