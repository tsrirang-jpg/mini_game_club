import type { CSSProperties } from 'react';
import { Card } from '../ui/Card';
import { PokChip } from './PokChip';
import { evaluate, handLabel } from '../../../../../packages/shared/src/index';
import type { PlayerView, Snapshot } from '../../../../../packages/shared/src/index';
import type { SessionState } from '../../session';
export type ArenaPosition = 'top'|'left-top'|'left-bottom'|'right-top'|'right-bottom';

export function PokSeat({player:p,s,state,showCatches,position}: {
  player:PlayerView; s:Snapshot; state:SessionState; showCatches:()=>void; position?:ArenaPosition;
}) {
  const catches=s.catches??[], result=s.results.find(r=>r.id===p.id)??catches.find(r=>r.id===p.id);
  const revealed=s.revealedHands?.find(r=>r.id===p.id), own=p.id===state.playerId, dealer=p.id===s.dealerId;
  const idle=s.phase==='LOBBY'||s.phase==='ROUND_END';
  const cards=result?.cards??revealed?.cards??(own&&state.handRound===s.roundId?state.hand:dealer?catches[0]?.dealerCards??[]:[]);
  const ownValue=own&&p.cardCount>=2&&cards.length>=2?evaluate(cards,s.rules):null;
  const handCount=Math.max(2,p.cardCount);
  const winner=!!result&&result.delta>0;
  return <article aria-label={'ผู้เล่น '+p.name} data-position={position} data-card-count={p.cardCount}
    style={{'--hand-count':handCount} as CSSProperties}
    className={'seat arena-seat '+(own?'own ':'')+(dealer?'is-dealer ':'')+(winner?'is-winner ':'')+(!p.connected?'disconnected ':'')+(ownValue?.special?'has-special-hand ':'')+(result?'has-result ':'')+(s.phase==='DEALER_ACTION'&&!dealer&&p.cardCount===3&&!result?'catchable':'')}>
    <div className="player-name" title={p.name}><span className="pok-player-label">{p.name}</span>{own&&<span className="pok-own-badge">คุณ</span>}{p.isBot&&<span className="bot-badge">บอท</span>}{dealer&&<span className="dealer">เจ้ามือ</span>}</div>
    <div className="points"><PokChip/><span className="pok-balance">{p.points.toLocaleString()} <small>แต้ม</small></span></div>
    <div className="hand">{Array.from({length:handCount},(_,i)=>i<p.cardCount?<Card key={s.roundId+'-'+i} card={cards[i]} index={i}/>:<span key={'empty-'+i} className="arena-card-placeholder" aria-hidden="true"/>)}</div>
    {!result&&<div className="player-status">
      {ownValue&&<div className={'pok-own-value'+(ownValue.special?' special-hand':'')} aria-label={handLabel(ownValue)+' · ×'+ownValue.multiplier}><strong>{handLabel(ownValue)}</strong><span className="pok-hand-multiplier"> · {ownValue.multiplier} เด้ง</span></div>}
      <span className="pok-status-copy">{revealed?`${handLabel(revealed)} · ${revealed.multiplier} เด้ง`:!p.connected?'กำลังเชื่อมต่อใหม่':idle?p.ready||p.id===s.hostId?'● พร้อม':'รอพร้อม':p.acted?'ตัดสินใจแล้ว':'รอตัดสินใจ'}{!dealer&&` · วาง ${p.bet}`}</span>
    </div>}
    {result&&<div className={'result '+(result.delta>0?'win':result.delta<0?'lose':'')}><span className="pok-result-hand">{handLabel(result)} · <span className="pok-hand-multiplier">{result.multiplier} เด้ง</span></span><span className="pok-result-outcome">{result.caught&&<button className="pok-caught-info" aria-label={'ดูผลจับ '+p.name} onClick={showCatches}>{result.catchRecompared?'เทียบใหม่':'จับ'}</button>}{result.outcome==='TIE'?'เสมอ':result.outcome==='DEALER'?'รวมเจ้ามือ':result.outcome==='WIN'?'ชนะ':'แพ้'} {result.delta>0?'+':''}{result.delta}</span></div>}
  </article>;
}
