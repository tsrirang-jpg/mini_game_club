import './whoami.css';
import { useEffect, useMemo, useState } from 'react';
import { whoAmISession } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { CopyRoomCodeButton } from './components/ui/CopyRoomCodeButton';
import { GameDialog } from './components/ui/GameDialog';
import { WhoAmIRules } from './components/entry/WhoAmIRules';
import { WhoAmIArtwork } from './WhoAmIArtwork';
import { WhoAmISettingsFields } from './WhoAmISettingsFields';
import { useDeadlineNow } from './hooks/useDeadlineNow';
import { WHO_ANSWER_LABELS } from '../../../packages/shared/src/whoami';
import type { WhoAnswer, WhoPlayer, WhoPrivate, WhoQuestion, WhoSnapshot } from '../../../packages/shared/src/whoami';

function AnswerBadge({answer}:{answer:WhoAnswer|null}){return <span className={`who-answer-badge ${answer??'pending'}`}>{answer?WHO_ANSWER_LABELS[answer]:'รอคำตอบ'}</span>;}
function QuestionHistory({history}:{history:WhoQuestion[]}){return <div className="who-history-list">{history.length?[...history].reverse().map(q=><article className="who-history-item" key={q.id}>
  <div className="who-history-question"><div><small>{q.name} · ตา {q.turnNumber}</small><p>{q.text}</p></div><AnswerBadge answer={q.answer}/></div>
  {q.counts&&<div className="who-history-answers" aria-label="คำตอบทั้งหมด">{(['yes','no','unknown'] as const).map(answer=><span key={answer} className={`who-history-answer ${answer}`}>{WHO_ANSWER_LABELS[answer]} <b>{q.counts![answer]}</b></span>)}</div>}
</article>):<p className="who-empty">ยังไม่มีคำถามของคุณในเกมนี้</p>}</div>;}
function Roster({s,privateState,playerId}:{s:WhoSnapshot;privateState:WhoPrivate|null;playerId:string}){
  const words=new Map(privateState?.identities.map(word=>[word.playerId,word]));
  return <div className="who-roster-list">{s.players.map(p=>{
    const own=p.id===playerId,identity=own?null:words.get(p.id);
    return <article key={p.id} className={`who-player ${own?'own':''} ${s.turnId===p.id?'current':''} ${!p.connected?'offline':''}`}>
      <div><strong>{p.name} {own&&<small>คุณ</small>}</strong><span className={`who-player-word ${own||!identity?'is-placeholder':''}`}>{own?'ซ่อนคำของคุณ':identity?.word??'รอเริ่มเกม'}</span><small className="who-player-status">{!p.connected?'ออฟไลน์':p.solved?'✓ ทายถูกแล้ว':s.phase==='LOBBY'?p.id===s.hostId?'ผู้สร้างห้อง':p.ready?'พร้อมแล้ว':'รอพร้อม':`${p.score} คะแนน`}</small></div>
    </article>;
  })}</div>;
}
function Scoreboard({players}:{players:WhoPlayer[]}){return <ol className="who-scoreboard">{[...players].sort((a,b)=>b.score-a.score||a.seat-b.seat).map(p=><li key={p.id}><span>{p.name}</span><strong>{p.score}<small> คะแนน</small></strong></li>)}</ol>;}
export function WhoAmIPlayPage({state,code}:{state:SessionState<WhoSnapshot>;code:string}) {
  const s=state.snapshot,now=useDeadlineNow(s?.deadline);
  const ownHistory=useMemo(()=>s?.history.filter(question=>question.playerId===state.playerId)??[],[s?.history,state.playerId]);
  const [questionText,setQuestionText]=useState(''),[guess,setGuess]=useState('');
  const [dialog,setDialog]=useState<'guess'|'history'|'players'|'rules'|null>(null);
  useEffect(()=>{setQuestionText('');setGuess('');setDialog(current=>current==='guess'?null:current);},[s?.roundId,s?.turnNumber,s?.phase]);
  if(!s||s.code!==code)return <main className="page-message"><h1>{state.status==='reconnecting'?'กำลังกลับเข้าห้อง…':'ยังไม่ได้เข้าห้อง Who am I นี้'}</h1><p>{code}</p>{state.status==='idle'&&<button className="primary" onClick={()=>navigate('/whoami/rooms/join?code='+code)}>เข้าห้องนี้</button>}</main>;
  const connected=state.status==='connected',host=s.hostId===state.playerId,me=s.players.find(p=>p.id===state.playerId);
  const own=s.turnId===state.playerId,playing=s.phase==='PLAYING';
  const privateState=state.whoAmI?.roundId===s.roundId?state.whoAmI:null;
  const live=connected&&playing&&now<s.deadline;
  const canGuess=live&&own&&!me?.solved&&!s.question;
  const ownAnswer=privateState?.turnNumber===s.turnNumber?privateState.ownAnswer:null;
  const canAnswer=live&&!own&&s.question?.answer===null&&privateState?.turnNumber===s.turnNumber&&!ownAnswer;
  const turn=s.players.find(p=>p.id===s.turnId),seconds=Math.max(0,Math.min(s.turnDurationMs/1000,Math.ceil((s.deadline-now)/1000)));
  const time=`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`;
  const responders=s.players.filter(p=>p.id!==s.turnId&&p.connected).length;
  const completed=s.phase==='GAME_END'||s.phase==='RESULTS',maxScore=Math.max(0,...s.players.map(p=>p.score));
  return <main className={`who-game phase-${s.phase}`}>
    <div className="room-bar"><div className="club-room-id"><span className="club-wordmark">♠ <b>Who am I</b></span><strong className="who-room-code">{s.code}</strong><CopyRoomCodeButton code={s.code}/></div><div className="club-room-tools"><button className="small" onClick={()=>setDialog('rules')}>กติกา</button><button className="small who-players-button" onClick={()=>setDialog('players')}>ผู้เล่น</button><button className="ghost" onClick={()=>whoAmISession.leave()}>ออกจากห้อง</button></div></div>
    <div className="who-status"><span>{playing?`เกม ${s.gameNumber}/${s.gameRounds} · ถามรอบ ${s.questionRound}/${s.questionRounds}`:s.phase==='LOBBY'?'เตรียมเข้าวง':s.phase==='RESULTS'?'ครบทุกเกมแล้ว':`จบเกม ${s.gameNumber}/${s.gameRounds}`} <small>· {s.players.length}/8 คน</small></span><strong role="timer" aria-label="เวลาที่เหลือ">{s.deadline?time:'—'}</strong></div>
    <div className="who-dashboard">
      <aside className="who-panel who-roster"><h2>เพื่อนในวง <small>{s.players.length}/8</small></h2><Roster s={s} privateState={privateState} playerId={state.playerId}/></aside>
      <section className="who-panel who-stage">
        {s.phase==='LOBBY'?<div className="who-lobby"><WhoAmIArtwork/><h1>ชวนเพื่อนมาทายตัวตน</h1><p>แต่ละคนเห็นคำของเพื่อน แต่ไม่เห็นคำของตัวเอง</p>{host?<><WhoAmISettingsFields value={s} disabled={!connected} onChange={settings=>whoAmISession.send('setSettings',settings)}/><button className="primary full" disabled={!connected||s.players.length<3||s.players.some(p=>!p.connected||(p.id!==s.hostId&&!p.ready))} onClick={()=>whoAmISession.send('startRound')}>เริ่มเกม</button><small>อย่างน้อย 3 คน · รอเพื่อนทุกคนกดพร้อม</small></>:<><p>ถามคนละ {s.questionRounds} รอบ · เล่น {s.gameRounds} เกม<br/>เวลาคนละ {s.turnMinutes} นาที</p><button className="primary full" disabled={!connected} onClick={()=>whoAmISession.send('setReady',!me?.ready)}>{me?.ready?'ยกเลิกพร้อม':'พร้อมเล่น'}</button></>}</div>
        :completed&&s.result?<div className="who-results"><span className="eyebrow">{s.phase==='RESULTS'?'MATCH COMPLETE':'GAME COMPLETE'}</span><h1>{s.phase==='RESULTS'?'สรุปคะแนนทั้งชุด':`เฉลยเกมที่ ${s.gameNumber}`}</h1><p>{s.result.reason==='all_solved'?'ทุกคนทายถูกแล้ว':s.result.reason==='not_enough_players'?'ผู้เล่นที่เชื่อมต่อไม่พอ':'ครบรอบการถามแล้ว'}</p>{s.phase==='RESULTS'&&<h2>{maxScore?`ผู้ชนะ: ${s.players.filter(p=>p.score===maxScore).map(p=>p.name).join(', ')}`:'เกมนี้ยังไม่มีใครทายถูก'}</h2>}<div className="who-reveals">{s.result.identities.map(p=><article key={p.playerId} className={p.playerId===state.playerId?'own':''}><strong>{p.name}{p.playerId===state.playerId?' · คุณ':''}</strong><b>{p.word}</b><small>{p.solved?'✓ ทายถูก +1':'ยังทายไม่ถูก'}</small></article>)}</div>{host?<div className="who-result-actions">{s.phase==='GAME_END'&&<button className="primary" disabled={!connected||s.players.filter(p=>p.connected).length<3} onClick={()=>whoAmISession.send('nextGame')}>เริ่มเกมถัดไป →</button>}<button disabled={!connected} onClick={()=>whoAmISession.send('prepareRound')}>{s.phase==='RESULTS'?'เตรียมเล่นชุดใหม่':'กลับห้องรอ'}</button></div>:<p>รอผู้สร้างห้องเริ่มเกมถัดไป</p>}</div>
        :<><h1 className="who-turn-title">{own?'ตาของคุณ · ถามได้เลย':`ตาของ ${turn?.name??'เพื่อน'}`}</h1><div className="who-mystery"><div><span className="who-avatar">{Array.from(me?.name??'?').slice(0,1)}</span><strong>{me?.name} <small>คุณ</small></strong><p>{me?.solved?'✓ คุณทายถูกแล้ว · ช่วยตอบเพื่อนต่อได้':'ซ่อนคำของคุณ'}</p></div><div className="who-mystery-card" aria-label="ตัวตนของคุณถูกซ่อน"><span>?</span><b>ฉันคือใคร?</b></div></div>
          <div className="who-question" aria-live="polite"><h2>{s.question?.text??(own?'เริ่มถามคำถามที่ตอบได้ว่าใช่หรือไม่':`รอ ${turn?.name??'เพื่อน'} ถามคำถาม`)}</h2>{s.question?<><AnswerBadge answer={s.question.answer}/><small>{s.question.answer?`${s.question.respondedIds.length} คนตอบแล้ว`:`${s.question.respondedIds.filter(id=>s.players.some(p=>p.id===id&&p.connected)).length}/${responders} คนตอบแล้ว`}</small></>:<small>เลือกถาม 1 คำถาม หรือทาย 1 ครั้งในตานี้</small>}</div>
          {!own&&s.question&&<div className="who-vote-area">{s.question.answer===null?<><p>{ownAnswer?`คุณตอบ “${WHO_ANSWER_LABELS[ownAnswer]}” แล้ว`:'ช่วยตอบคำถามของเพื่อน'}</p><div className="who-answer-actions">{(['yes','no','unknown'] as const).map(answer=><button className={`who-answer-choice ${answer} ${ownAnswer===answer?'chosen':''}`} disabled={!canAnswer} key={answer} onClick={()=>whoAmISession.send('answer',answer)}>{WHO_ANSWER_LABELS[answer]}</button>)}</div></>:<p>รอเพื่อนทายคำตอบหรือจบตา</p>}</div>}
          {s.lastGuess&&<p className={`who-last-guess ${s.lastGuess.correct?'correct':''}`} role="status">{s.lastGuess.name} ทาย “{s.lastGuess.text}” · {s.lastGuess.correct?'ถูกต้อง +1 คะแนน':'ยังไม่ถูก · ส่งต่อให้คนถัดไป'}</p>}
          {own&&<div className="who-compose"><form onSubmit={event=>{event.preventDefault();if(live&&own&&!s.question&&questionText.trim()){whoAmISession.clearError();whoAmISession.send('ask',questionText);setQuestionText('');}}}><label className="sr-only" htmlFor="who-question">คำถามของคุณ</label><input id="who-question" maxLength={200} value={questionText} disabled={!live||!own||!!s.question} onChange={event=>setQuestionText(event.target.value)} placeholder={own?'พิมพ์คำถามของคุณ':'รอถึงตาของคุณ'}/><button className="primary" disabled={!live||!own||!!s.question||!questionText.trim()}>ส่งคำถาม</button></form><div className="who-turn-actions"><button className="who-guess-button" disabled={!canGuess} onClick={()=>{whoAmISession.clearError();setDialog('guess');}}>ขอทายคำตอบ</button>{own&&<button disabled={!live} onClick={()=>whoAmISession.send('endTurn')}>จบตา</button>}</div>{s.question&&<p className="who-next-turn-hint">ถามแล้ว · รอทายได้ในตาของคุณครั้งถัดไป</p>}</div>}
        </>}
      </section>
      <aside className="who-panel who-history"><h2>{completed?'คะแนนสะสม':'ประวัติคำถามของคุณ'}</h2>{completed?<Scoreboard players={s.players}/>:<QuestionHistory history={ownHistory}/>}</aside>
    </div>
    <button className="who-history-shortcut" onClick={()=>setDialog('history')}>{completed?'คะแนนสะสม':`ประวัติคำถามของคุณ (${ownHistory.length})`} <span>›</span></button>
    {dialog==='guess'&&canGuess&&<GameDialog title="ทายตัวตนของคุณ" onClose={()=>setDialog(null)} className="who-dialog"><p>ทายได้ 1 ครั้งในตานี้ ทายผิดจะส่งตาให้เพื่อน</p><form onSubmit={event=>{event.preventDefault();if(canGuess&&guess.trim()){whoAmISession.clearError();whoAmISession.send('guess',guess);}}}><label>คำตอบของคุณ<input autoFocus required maxLength={80} autoComplete="off" placeholder="คุณคิดว่าตัวเองเป็นใคร?" value={guess} onChange={event=>setGuess(event.target.value)}/></label>{state.error&&<p role="alert">{state.error}</p>}<button className="primary full" disabled={!guess.trim()||!canGuess}>ยืนยันคำตอบ</button></form></GameDialog>}
    {dialog==='history'&&<GameDialog title={completed?'คะแนนสะสม':'ประวัติคำถามของคุณ'} onClose={()=>setDialog(null)} className="who-dialog">{completed?<Scoreboard players={s.players}/>:<QuestionHistory history={ownHistory}/>}</GameDialog>}
    {dialog==='players'&&<GameDialog title="ผู้เล่นในวง" onClose={()=>setDialog(null)} className="who-dialog"><Roster s={s} privateState={privateState} playerId={state.playerId}/></GameDialog>}
    {dialog==='rules'&&<GameDialog title="กติกา Who am I" onClose={()=>setDialog(null)} className="who-dialog"><WhoAmIRules open/></GameDialog>}
  </main>;
}
