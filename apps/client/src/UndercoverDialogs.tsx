import {useEffect,useState} from 'react';
import {LobbyIcon} from './components/ui/LobbyIcon';
import './undercover-voting.css';
import {GameDialog} from './components/ui/GameDialog';
import {PlayerVotingContent} from './components/ui/PlayerVotingContent';
import {UnderRolePortrait,underRoleNames} from './UndercoverRolePortrait';
import type {UnderSnapshot,UnderSecret,UnderVote} from '../../../packages/shared/src/undercover';

export function UnderVoteDialog({s,playerId,secret,connected,seconds,onVote}:{s:UnderSnapshot;playerId:string;secret:UnderSecret|null;connected:boolean;seconds:number;onVote(v:UnderVote):void}) {
  const [targetId,setTargetId]=useState(''),[pending,setPending]=useState(false);
  const submitted=s.submittedIds.includes(playerId),alive=!!s.players.find(p=>p.id===playerId)?.alive;
  useEffect(()=>{if(!submitted||!connected)setPending(false);},[submitted,connected]);
  useEffect(()=>{if(targetId&&!s.eligibleIds.includes(targetId))setTargetId('');},[s.eligibleIds,targetId]);
  const selected=submitted?secret?.vote?.targetId??targetId:targetId;
  const clues=new Map(s.hints.filter(h=>h.cycle===s.cycle).map(h=>[h.playerId,h.text]));
  const canVote=connected&&!submitted&&!pending&&alive&&seconds>0;
  return <GameDialog title="ใครคือผู้ต้องสงสัย?" onClose={()=>{}} dismissible={false} className="spy-voting-dialog under-dialog under-vote-dialog">
    <PlayerVotingContent title={s.runoff?'คะแนนเสมอ · โหวตอีกครั้ง':'ใครคือผู้ต้องสงสัย?'} eyebrow={`UNDERCOVER · รอบ ${s.cycle}`}
      description={s.runoff?'อ่านคำใบ้ เลือกจากผู้ที่เสมอ แล้วกดยืนยัน':'อ่านคำใบ้ เลือกผู้เล่น 1 คน แล้วกดยืนยัน'} showClues emblem={<LobbyIcon name="people"/>} confirmIcon={<LobbyIcon name="send"/>}
      players={s.players.filter(p=>p.alive).map(p=>({...p,clue:clues.get(p.id),confirmed:s.submittedIds.includes(p.id),eligible:s.eligibleIds.includes(p.id)}))}
      playerId={playerId} selected={selected||null} canVote={canVote} confirmed={submitted} submitting={pending} active={connected}
      seconds={seconds} progress={seconds/(s.voteMinutes*60)*100} select={setTargetId}
      note={alive?'ยืนยันครบทุกคนจะแสดงผลพร้อมกัน':'คุณออกจากรอบแล้ว · รอติดตามผลโหวต'}
      confirm={()=>{if(canVote&&targetId){setPending(true);onVote({targetId});}}}/>
  </GameDialog>;
}

function Countdown({seconds,duration=60}:{seconds:number;duration?:number}) {
  return <div className="under-countdown"><strong role="timer">{String(Math.floor(seconds/60)).padStart(2,'0')}:{String(seconds%60).padStart(2,'0')}</strong><div className="under-time-track" aria-hidden="true"><i style={{width:`${Math.max(0,Math.min(100,seconds/duration*100))}%`}}/></div></div>;
}
export function UnderRevealDialog({s,seconds}:{s:UnderSnapshot;seconds:number}) {
  const role=s.lastVote?.role,target=s.players.find(p=>p.id===s.lastVote?.targetId);
  if(!role||!target)return null;
  return <GameDialog title="ผลโหวต" dismissible={false} onClose={()=>{}} className="under-dialog under-reveal-dialog">
    <p className="under-reveal-intro">{target.name} ได้รับคะแนนสูงสุด</p>
    <div className="under-reveal-content">
      <UnderRolePortrait role={role}/>
      <div className="under-reveal-identity"><p>{target.name} คือ</p><strong>{underRoleNames[role]}</strong><p>{role==='white'?'ยังมีโอกาสทายคำลับเพื่อพลิกชนะ':'ออกจากรอบนี้แล้ว'}</p></div>
    </div>
    <p className="under-reveal-next" role="status">{role==='white'?'เปิดหน้าตอบคำลับ':'ดำเนินเกมต่อ'}ใน {seconds} วินาที</p>
  </GameDialog>;
}

export function UnderGuessDialog({s,own,connected,seconds,onGuess,onSurrender}:{s:UnderSnapshot;own:boolean;connected:boolean;seconds:number;onGuess(answer:string):void;onSurrender():void}) {
  const [answer,setAnswer]=useState(''),[pending,setPending]=useState(false);
  useEffect(()=>{if(!connected)setPending(false);},[connected]);
  const locked=pending||!connected||seconds<=0;
  return <GameDialog title={own?'คุณถูกโหวต · Mr. White':'Mr. White ถูกเลือก'} dismissible={false} onClose={()=>{}} className={`under-dialog under-guess-dialog ${own?'own-guess':'under-observer-dialog'}`}>
    <p>{own?'ทายคำของคนธรรมดาให้ถูกเพื่อพลิกชนะ':`${s.players.find(p=>p.id===s.guesserId)?.name??'Mr. White'} กำลังทายคำของคนธรรมดา`}</p>
    <div className="under-guess-content"><Countdown seconds={seconds}/>
      {own?<form onSubmit={e=>{e.preventDefault();if(answer.trim()&&!locked){setPending(true);onGuess(answer.trim());}}}>
        <label>คำของคนธรรมดาคืออะไร?<input autoFocus required maxLength={80} autoComplete="off" value={answer} disabled={locked} onChange={e=>setAnswer(e.target.value)} placeholder="พิมพ์คำตอบของคุณ"/></label>
        <small>ยืนยันได้ครั้งเดียว · เห็นช่องตอบเฉพาะคุณ</small>
        <div className="under-dialog-actions"><button type="button" disabled={locked} onClick={()=>{setPending(true);onSurrender();}}>ยอมแพ้</button><button className="primary" disabled={locked||!answer.trim()}>{pending?'กำลังส่ง…':'ยืนยันคำตอบ'}</button></div>
      </form>:<div className="under-observer-status" role="status"><div className="under-waiting" aria-hidden="true">•••</div><strong>รอคำตอบก่อนสรุปผล</strong><p>ผลจะแสดงพร้อมกันเมื่อตอบ ยอมแพ้ หรือหมดเวลา</p></div>}
    </div>
  </GameDialog>;
}
