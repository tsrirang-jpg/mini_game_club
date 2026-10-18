import {useEffect,useRef,useState} from 'react';
import type {UnderResult,UnderRole,UnderSnapshot} from '../../../packages/shared/src/undercover';
import {GameDialog} from './components/ui/GameDialog';
import {UnderHistory} from './UndercoverPanels';
import {UnderRolePortrait,underRoleNames} from './UndercoverRolePortrait';
import './undercover-results.css';

// The server's result reason identifies the winning faction, independent of viewer.
const outcomes:Record<UnderResult['reason'],{role:UnderRole|null;title:string;description:string}>={
  citizens:{role:'citizen',title:'คนธรรมดาชนะ',description:'จับคนที่ได้คำต่างสำเร็จ'},
  undercover:{role:'undercover',title:'Undercover ชนะ',description:'ซ่อนคำต่างได้แนบเนียนจนถึงท้ายเกม'},
  white_guess:{role:'white',title:'Mr. White ชนะ',description:'ทายคำของคนธรรมดาถูก พลิกกลับมาชนะ'},
  last_white:{role:'white',title:'Mr. White ชนะ',description:'อยู่รอดเป็นฝ่ายสุดท้ายในรอบนี้'},
  not_enough_players:{role:null,title:'จบรอบ',description:'ผู้เล่นไม่เพียงพอ ไม่มีฝ่ายชนะในรอบนี้'},
};

function VictoryLaurels() {
  return <svg className="under-victory-laurels" viewBox="0 0 400 200" fill="currentColor" aria-hidden="true">
    {[false,true].map(mirror=><g key={String(mirror)} transform={mirror?'translate(400 0) scale(-1 1)':undefined}>
      <path d="M145 183C80 165 55 119 69 68" fill="none" stroke="currentColor" strokeWidth="2"/>
      {[0,1,2,3,4,5,6].map(i=><g key={i} transform={`translate(${68+i*i*1.55} ${76+i*15}) rotate(${-20-i*9})`}><ellipse cx="-9" cy="-4" rx="5" ry="12"/><ellipse cx="9" cy="4" rx="5" ry="12" transform="rotate(75 9 4)"/></g>)}
      <path d="m42 42 3 7 7 3-7 3-3 7-3-7-7-3 7-3zM106 17l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM24 112l2 4 4 2-4 2-2 4-2-4-4-2 4-2z"/>
    </g>)}
  </svg>;
}

export function UndercoverResults({s,result,playerId,host,connected,onPrepare}:{s:UnderSnapshot;result:UnderResult;playerId:string;host:boolean;connected:boolean;onPrepare():void}) {
  const [summaryOpen,setSummaryOpen]=useState(false);
  const summaryTrigger=useRef<HTMLButtonElement>(null),summaryWasOpen=useRef(false);
  useEffect(()=>{if(summaryWasOpen.current&&!summaryOpen)summaryTrigger.current?.focus();summaryWasOpen.current=summaryOpen;},[summaryOpen]);
  const outcome=outcomes[result.reason];
  const winnerIds=new Set(result.winnerIds);
  const names=new Map([...s.players.map(p=>[p.id,p.name] as const),...result.words.map(p=>[p.playerId,p.name] as const)]);
  const winnerNames=result.winnerIds.map(id=>names.get(id)??'ผู้เล่น').join(', ');
  return <section className="under-results" aria-labelledby="under-results-title">
    <div className="under-results-content">
      <header className={`under-victory${outcome.role?'':' no-winner'}`}>
        {outcome.role&&<div className="under-victory-art"><VictoryLaurels/><UnderRolePortrait role={outcome.role}/></div>}
        <h1 id="under-results-title">{outcome.title}</h1>
        <p>{outcome.description}</p>
      </header>
      <div className="under-result-facts">
        <p><span>ผู้ชนะ:</span><strong className="under-result-winner-names" tabIndex={0}>{winnerNames||'ไม่มีผู้ชนะ'}</strong></p>
        <p><span>คำลับของรอบนี้:</span><strong className="under-result-answer">{result.answer??'—'}</strong></p>
      </div>
      <div className="under-result-table-wrap" tabIndex={0} role="region" aria-label="ผลของผู้เล่นทุกคน">
        <table className="under-result-table"><caption className="sr-only">คำที่ได้รับและผลของผู้เล่นในรอบนี้</caption><thead><tr><th scope="col">ผู้เล่น</th><th scope="col">คำที่ได้รับ</th><th scope="col">ผลลัพธ์</th></tr></thead>
          <tbody>{result.words.map(p=>{
            const won=winnerIds.has(p.playerId);
            return <tr key={p.playerId} className={won?'winner':''}>
              <th scope="row"><span>{p.name}</span>{p.playerId===playerId&&<small className="under-result-own">คุณ</small>}</th>
              <td>{p.word??'ไม่ได้รับคำลับ'}</td>
              <td><span className={`under-result-status ${won?'won':'lost'}`}><i aria-hidden="true">{won?'✓':result.winnerIds.length?'×':'–'}</i>{won?'ชนะ':result.winnerIds.length?'แพ้':'จบรอบ'}</span></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <footer className="under-result-actions">
        <div className="under-result-buttons"><button type="button" className="primary" disabled={!host||!connected} onClick={onPrepare}><span aria-hidden="true">⟳</span>กลับห้องรอ / เล่นอีกครั้ง</button><button ref={summaryTrigger} type="button" className="under-result-summary-button" onClick={()=>setSummaryOpen(true)}><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 12h4v9H3zm7-9h4v18h-4zm7 5h4v13h-4z"/></svg>ดูสรุปรอบนี้</button></div>
        {!host&&<small role="status">รอเจ้าของห้องเตรียมรอบใหม่</small>}
      </footer>
    </div>
    {summaryOpen&&<GameDialog title="สรุปรอบนี้" onClose={()=>setSummaryOpen(false)} className="under-dialog under-round-summary">
      <strong className="under-summary-winner">{outcome.title}</strong><p>ผู้ชนะ: {winnerNames||'ไม่มีผู้ชนะ'}</p><p>คำลับของคนธรรมดา: <strong>{result.answer??'—'}</strong></p>
      {result.guess!==null&&<p>คำตอบสุดท้าย: <strong>{result.guess}</strong></p>}
      {!!s.lastVote?.targetId&&<p>ผู้ถูกโหวตล่าสุด: <strong>{names.get(s.lastVote.targetId)??'ผู้เล่น'}</strong>{s.lastVote.role&&` · ${underRoleNames[s.lastVote.role]}`}</p>}
      {!!Object.keys(s.lastVote?.counts??{}).length&&<ul className="under-summary-votes">{Object.entries(s.lastVote!.counts).map(([id,count])=><li key={id}><span>{names.get(id)??'ผู้เล่น'}</span><strong>{count} เสียง</strong></li>)}</ul>}
      <h3>คำใบ้ในรอบนี้</h3><UnderHistory hints={s.hints} cycle={s.cycle}/>
    </GameDialog>}
  </section>;
}
