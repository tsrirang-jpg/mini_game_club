import {memo,useEffect,useRef,useState} from 'react';
import type {UnderChatMessage} from '../../../packages/shared/src/undercover';
import {UNDER_CHAT_MAX_LENGTH} from '../../../packages/shared/src/undercover';
import {GameDialog} from './components/ui/GameDialog';
import {LobbyIcon} from './components/ui/LobbyIcon';

const desktopQuery='(min-width:1000px) and (min-height:651px)';
const time=new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'});

function ChatPanel({messages,playerId,enabled,draft,onDraft,pending,onSend}:{messages:UnderChatMessage[];playerId:string;enabled:boolean;draft:string;onDraft(value:string):void;pending:boolean;onSend():void}) {
 const log=useRef<HTMLDivElement>(null),nearBottom=useRef(true);
 const latest=messages.at(-1);
 useEffect(()=>{const el=log.current;if(el&&(nearBottom.current||latest?.playerId===playerId)){el.scrollTop=el.scrollHeight;nearBottom.current=true;}},[latest?.id,playerId,latest?.playerId]);
 return <section className="under-chat-panel" aria-label="สนทนาในห้อง">
  <header><h2><LobbyIcon name="chat"/>แชทห้อง</h2><small><LobbyIcon name="people"/>ทุกคนในห้อง</small></header>
  <div className="under-chat-log" ref={log} role="log" aria-label="ประวัติแชทห้อง" aria-live="polite" tabIndex={0} onScroll={e=>{const el=e.currentTarget;nearBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<48;}}>
   {!messages.length&&<div className="under-chat-empty"><LobbyIcon name="chat"/><p>เริ่มพูดคุยกับเพื่อนในห้อง</p><small>ข้อความแชทแยกจากคำใบ้</small></div>}
   {messages.map(m=><article key={m.id} className={`under-chat-message${m.playerId===playerId?' mine':''}`}>
    <span className="under-chat-avatar" aria-hidden="true">{Array.from(m.name)[0]?.toLocaleUpperCase()}</span>
    <div><header><strong>{m.name}{m.playerId===playerId?' (คุณ)':''}</strong><time dateTime={new Date(m.timestamp).toISOString()}>{time.format(m.timestamp)}</time></header><p>{m.text}</p></div>
   </article>)}
  </div>
  <form className="under-chat-compose" onSubmit={e=>{e.preventDefault();if(enabled&&!pending&&draft.trim())onSend();}}>
   <label className="sr-only" htmlFor="under-chat-message">ข้อความแชท</label><textarea id="under-chat-message" maxLength={UNDER_CHAT_MAX_LENGTH} rows={1} value={draft} onChange={e=>onDraft(e.target.value)} disabled={!enabled||pending} placeholder={enabled?'พิมพ์ข้อความ…':'พักส่งแชทชั่วคราว'} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();e.currentTarget.form?.requestSubmit();}}}/>
   <button className="primary" aria-label="ส่งข้อความแชท" disabled={!enabled||pending||!draft.trim()}><LobbyIcon name="send"/></button>
   <small>{!enabled?'ส่งแชทได้ระหว่างอธิบายคำ เมื่อคุณยังอยู่ในรอบ':`${draft.length}/${UNDER_CHAT_MAX_LENGTH} · Enter ส่ง / Shift+Enter ขึ้นบรรทัดใหม่`}</small>
  </form>
 </section>;
}

// A single mounted chat panel: desktop sidebar or native mobile bottom sheet.
// No extra socket, polling, or duplicate message log on mobile.
export const UndercoverChat=memo(function UndercoverChat({messages,playerId,enabled,active,connected,error,onSend}:{messages:UnderChatMessage[];playerId:string;enabled:boolean;active:boolean;connected:boolean;error:string;onSend(text:string):void}) {
 const [wide,setWide]=useState(()=>window.matchMedia(desktopQuery).matches),[open,setOpen]=useState(false);
 const [draft,setDraft]=useState(''),[pending,setPending]=useState<{text:string;after:number}|null>(null),[seen,setSeen]=useState(0);
 const trigger=useRef<HTMLButtonElement>(null),wasOpen=useRef(false);
 const latest=messages.at(-1)?.id??0;
 useEffect(()=>{const media=window.matchMedia(desktopQuery),update=()=>setWide(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{if(wide||!active)setOpen(false);},[wide,active]);
 useEffect(()=>{if(wide||open)setSeen(latest);},[wide,open,latest]);
 useEffect(()=>{if(wasOpen.current&&!open&&!wide)trigger.current?.focus({preventScroll:true});wasOpen.current=open;},[open,wide]);
 useEffect(()=>{if(!connected||error)setPending(null);},[connected,error]);
 useEffect(()=>{if(pending&&messages.some(m=>m.id>pending.after&&m.playerId===playerId&&m.text===pending.text)){setPending(null);setDraft('');}},[messages,pending,playerId]);
 const unread=messages.filter(m=>m.id>seen&&m.playerId!==playerId).length;
 const panel=<ChatPanel messages={messages} playerId={playerId} enabled={enabled} draft={draft} onDraft={setDraft} pending={!!pending} onSend={()=>{if(enabled&&!pending&&draft.trim()){setPending({text:draft.trim(),after:latest});onSend(draft.trim());}}}/>;
 if(wide)return <aside className="under-chat-sidebar">{panel}</aside>;
 return <><button ref={trigger} className="under-chat-toggle" type="button" onClick={()=>setOpen(true)} disabled={!active} aria-haspopup="dialog" aria-expanded={open}><LobbyIcon name="chat"/>แชทห้อง{unread>0&&<span className="under-chat-unread" aria-label={`${unread} ข้อความใหม่`}>{unread}</span>}<span aria-hidden="true">⌃</span></button>
  {open&&active&&<GameDialog title="แชทห้อง" onClose={()=>setOpen(false)} className="under-dialog under-chat-sheet">{panel}</GameDialog>}
 </>;
});
