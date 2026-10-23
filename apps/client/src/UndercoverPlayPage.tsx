import { WaitingQueueButton } from './components/room/RoundWaitingRoom';
import {useCallback,useEffect,useState} from 'react';
import {underSession} from './session';
import type {SessionState} from './session';
import type {UnderSnapshot,UnderSecret} from '../../../packages/shared/src/undercover';
import {RoomIdentity} from './components/ui/RoomIdentity';
import {GameDialog} from './components/ui/GameDialog';
import {UndercoverRules} from './components/entry/UndercoverRules';
import {UndercoverLobby} from './UndercoverLobby';
import {UnderRoster,UnderWord} from './UndercoverPanels';
import {UndercoverDiscussion} from './UndercoverDiscussion';
import {UndercoverResults} from './UndercoverResults';
import {UnderVoteDialog,UnderGuessDialog,UnderRevealDialog} from './UndercoverDialogs';
import {useDeadlineNow} from './hooks/useDeadlineNow';
import './undercover.css';
export function UndercoverPlayPage({state,code}:{state:SessionState<UnderSnapshot>;code:string}){
 const s=state.snapshot,[rules,setRules]=useState(false),[hint,setHint]=useState(''),[pending,setPending]=useState(false);
 const sendChat=useCallback((text:string)=>{underSession.clearError();underSession.send('chat',text);},[]);
 const now=useDeadlineNow(s?.deadline);
 useEffect(()=>{setHint('');setPending(false);},[s?.roundId,s?.turnNumber]);
 useEffect(()=>{if(state.error)setPending(false);},[state.error]);
 useEffect(()=>{if(state.status!=='connected')setPending(false);},[state.status]);
 if(!s||s.code!==code)return <main className="page-message"><h1>กำลังเชื่อมต่อห้อง Undercover</h1><button onClick={()=>underSession.leave('/undercover/rooms/join?code='+code)}>เข้าห้อง Undercover</button></main>;
 const secret:UnderSecret|null=state.undercover?.roundId===s.roundId?state.undercover:null;
 const host=s.hostId===state.playerId,connected=state.status==='connected',own=s.turnId===state.playerId&&s.phase==='DESCRIBE';
 const seconds=Math.max(0,Math.ceil((s.deadline-now)/1000));
 return <main className={`under-game phase-${s.phase}`}><div className="room-bar"><RoomIdentity code={s.code}/><div className="club-room-tools"><WaitingQueueButton/><button className="small" onClick={()=>setRules(true)}>กติกา</button><button className="small ghost" onClick={()=>underSession.leave()}>ออกจากห้อง</button></div></div>
 {s.phase==='LOBBY'?<UndercoverLobby s={s} playerId={state.playerId} connected={connected} onSettings={settings=>underSession.send('setSettings',settings)} onReady={ready=>underSession.send('setReady',ready)} onStart={()=>underSession.send('startRound')}/>
 :s.phase==='RESULTS'&&s.result?<UndercoverResults key={s.roundId} s={s} result={s.result} playerId={state.playerId} host={host} connected={connected} onPrepare={()=>underSession.send('prepareRound')}/>
 :s.phase==='WORD'?<><section className="under-banner"><span className="eyebrow">UNDERCOVER · เตรียมเริ่มรอบ</span><h1>คำลับของคุณ</h1><span className="under-clock" role="timer">{seconds} วินาที</span></section><div className="under-dashboard"><aside className="under-roster"><h2>ผู้เล่น ({s.players.filter(p=>p.alive).length}/{s.players.length})</h2><UnderRoster players={s.players} playerId={state.playerId} turnId={s.turnId}/></aside>
 <section className="under-main"><UnderWord secret={secret}/><button className="primary under-ack" disabled={!connected||!secret||s.acknowledgedIds.includes(state.playerId)} onClick={()=>underSession.send('acknowledge')}>{s.acknowledgedIds.includes(state.playerId)?'พร้อมแล้ว · รอเพื่อน':'พร้อมเริ่มอธิบาย'}</button><p className="fine">{s.acknowledgedIds.length}/{s.players.length} คนพร้อม · เริ่มอัตโนมัติเมื่อหมดเวลา</p></section></div></>
 :<UndercoverDiscussion s={s} playerId={state.playerId} secret={secret} connected={connected} seconds={seconds} hint={hint} onHint={setHint} pending={pending} error={state.error} onSubmit={()=>{if(own&&hint.trim()&&!pending&&connected){underSession.clearError();setPending(true);underSession.send('hint',hint.trim());}}} onChat={sendChat} onReadyVote={()=>{underSession.clearError();underSession.send('readyVote');}}/>}

 {rules&&<GameDialog title="กติกา Undercover" onClose={()=>setRules(false)} className="under-dialog"><UndercoverRules open/></GameDialog>}
 {s.phase==='VOTING'&&<UnderVoteDialog key={`${s.roundId}-${s.turnNumber}-${state.error}`} s={s} playerId={state.playerId} secret={secret} connected={connected} seconds={seconds} onVote={vote=>{underSession.clearError();underSession.send('vote',vote);}}/>}
 {s.phase==='REVEAL'&&<UnderRevealDialog s={s} seconds={seconds}/>}
 {s.phase==='GUESS'&&<UnderGuessDialog key={`${s.roundId}-${s.turnNumber}-${state.error}`} s={s} own={s.guesserId===state.playerId} connected={connected} seconds={seconds} onGuess={answer=>{underSession.clearError();underSession.send('guess',answer);}} onSurrender={()=>{underSession.clearError();underSession.send('surrender');}}/>}
 </main>;
}
