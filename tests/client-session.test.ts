import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({create:vi.fn(),joinById:vi.fn(),reconnect:vi.fn()}));
vi.mock('@colyseus/sdk', () => ({Client:class {create=sdk.create;joinById=sdk.joinById;reconnect=sdk.reconnect;}}));
const storage=new Map<string,string>();
function room() {
  const signals:Record<string, (...args: never[])=>void>={};
  const value={roomId:'ABCDEF0123',sessionId:'p0',reconnectionToken:'private-token',reconnection:{enabled:true,minUptime:0,maxRetries:0,maxEnqueuedMessages:0},
    connection:{isOpen:true,reconnect:vi.fn(),close:vi.fn()},send:vi.fn(),leave:vi.fn(async()=>1000),
    onMessage:vi.fn(),onError:vi.fn(),onDrop:(f:()=>void)=>signals.drop=f,onReconnect:(f:()=>void)=>signals.reconnect=f,onLeave:(f:()=>void)=>signals.leave=f};
  return {value,signals};
}
function pending<T>() {let resolve!:(value:T)=>void,reject!:(error:Error)=>void;const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject};}
beforeEach(()=>{
  vi.resetModules();vi.useFakeTimers();vi.clearAllMocks();storage.clear();
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key)});
  vi.stubGlobal('location',{protocol:'http:',host:'localhost',pathname:'/rooms/create',search:''});
  vi.stubGlobal('history',{pushState:vi.fn(),replaceState:vi.fn()});
  vi.stubGlobal('window',{dispatchEvent:vi.fn(),scrollTo:vi.fn()});
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
