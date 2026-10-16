import type { Card as CardData } from '../../../packages/shared/src/index';
import type { OldMaidActivity, OldMaidDraw } from '../../../packages/shared/src/oldmaid';
import { Card } from './components';

const symbols = {hearts:'♥', diamonds:'♦', spades:'♠', clubs:'♣'};
export function CardName({card}: {card:CardData}) {
  const rank = ({1:'A',11:'J',12:'Q',13:'K'} as Record<number,string>)[card.rank] ?? card.rank;
  return <span className={'oldmaid-card-name '+(card.suit==='hearts'||card.suit==='diamonds'?'red':'')}>{rank} {symbols[card.suit]}</span>;
}
export function PairName({cards}: {cards:CardData[]}) {
  return <>{cards.map((card,i)=><span key={card.suit}>{i>0&&' + '}<CardName card={card}/></span>)}</>;
}
export function OldMaidFeedback({draw}: {draw:OldMaidDraw}) {
  return <section className={'oldmaid-feedback'+(draw.pair.length?' paired':'')} data-draw-id={draw.id} aria-label="ผลการจั่วของคุณ" role="status" aria-live="polite">
    <header><strong>ผลการจั่วของคุณ</strong><span>เฉพาะคุณ</span></header>
    <div className="oldmaid-feedback-body">
      <div className="oldmaid-drawn"><Card card={draw.drawnCard}/><div><h2>จั่วได้ <CardName card={draw.drawnCard}/></h2><p>จาก {draw.targetName}</p>{!draw.pair.length&&<><span className="oldmaid-no-pair">ยังไม่มีคู่</span><p className="oldmaid-keep">เก็บไพ่ใบนี้ไว้ในมือของคุณ</p></>}</div></div>
      {draw.pair.length>0&&<div className="oldmaid-paired"><strong>✓ จับคู่แล้วทิ้ง</strong><div><div className="oldmaid-pair-cards">{draw.pair.map(card=><Card key={card.suit} card={card}/>)}</div><div><b><PairName cards={draw.pair}/></b><p>ทิ้งไพ่คู่นี้แล้ว 2 ใบ</p></div></div></div>}
    </div>
  </section>;
}
export function OldMaidHistory({history,draws,playerId}: {history:OldMaidActivity[];draws:OldMaidDraw[];playerId:string}) {
  // Merge only this player's private draw events with the public table history.
  const entries = new Map<number, OldMaidActivity | OldMaidDraw>();
  for (const entry of history) entries.set(entry.id,entry);
  for (const entry of draws) entries.set(entry.id,entry);
  return <section className="oldmaid-history"><h2>ประวัติรอบนี้</h2><p className="fine">แสดง 60 รายการล่าสุด · ไพ่ที่จั่วเห็นเฉพาะคุณ คู่ที่ทิ้งแล้วเห็นได้ทุกคน</p><ol>{[...entries.values()].sort((a,b)=>b.id-a.id).slice(0,60).map(entry=><li key={entry.id}>
    <div><strong>{entry.playerId===playerId?'คุณ':entry.playerName}</strong><small>{entry.kind==='deal'?'หลังแจกไพ่':`ตาที่ ${entry.turnNumber}`}</small></div>
    {entry.kind==='draw'&&<p>{'drawnCard' in entry?<>จั่วได้ <CardName card={entry.drawnCard}/></>:<>จั่วไพ่</>} จาก {entry.targetName}</p>}
    {entry.pair.length?<><span className="oldmaid-history-paired">✓ จับคู่ทิ้ง <PairName cards={entry.pair}/></span><div className="oldmaid-history-cards">{entry.pair.map(card=><Card key={card.suit} card={card}/>)}</div></>:<p className="fine">ยังไม่มีคู่</p>}
  </li>)}</ol>{!entries.size&&<p>ยังไม่มีรายการในรอบนี้</p>}</section>;
}
