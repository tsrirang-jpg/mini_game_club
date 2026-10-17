import { BrandLogo } from './components/ui/BrandLogo';
import { useDeadlineNow } from './hooks/useDeadlineNow';
import { CopyRoomCodeButton } from './components/ui/CopyRoomCodeButton';
import { SpyfallSelect as ClubSelect } from './SpyfallSelect';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { session } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { Card, Rules, phaseLabel } from './components';
import { evaluate, handLabel } from '../../../packages/shared/src/index';
import type { PlayerView, Snapshot } from '../../../packages/shared/src/index';
function PokSeat({ player: p, s, state, showCatches }: { player: PlayerView; s: Snapshot; state: SessionState; showCatches: () => void }) {
  const catches = s.catches ?? [];
  const result = s.results.find(r => r.id === p.id) ?? catches.find(r => r.id === p.id);
  const revealed = s.revealedHands?.find(r => r.id === p.id);
  const own = p.id === state.playerId;
  const idle = s.phase === 'LOBBY' || s.phase === 'ROUND_END';
  const cards = result?.cards ?? revealed?.cards ?? (own && state.handRound === s.roundId ? state.hand : p.id === s.dealerId ? catches[0]?.dealerCards ?? [] : []);
  const ownValue = own && !result && cards.length >= 2 ? evaluate(cards, s.rules) : null;
  return <article aria-label={'ผู้เล่น ' + p.name} className={`seat ${own ? 'own' : ''} ${!p.connected ? 'disconnected' : ''} ${s.phase === 'DEALER_ACTION' && p.id !== s.dealerId && p.cardCount === 3 && !result ? 'catchable' : ''}`}>
    <div className="player-name" title={p.name}><span className="pok-avatar" aria-hidden="true">{p.name.slice(0,1)}</span><span className="pok-player-label">{p.name}</span>{own && <span className="pok-own-badge">ไพ่ของคุณ</span>}{p.isBot && <span className="bot-badge">บอท</span>}{p.id === s.dealerId && <span className="dealer">เจ้ามือ</span>}</div>
    <div className="hand">{Array.from({ length: p.cardCount }, (_, i) => <Card key={`${s.roundId}-${i}`} card={cards[i]} index={i}/>)}</div>
    <div className="points">{p.points.toLocaleString()} <small>แต้ม</small></div>
    {ownValue && <div className="pok-own-value">{handLabel(ownValue)} · ×{ownValue.multiplier}</div>}
    {!result && <div className="player-status">{revealed ? `${handLabel(revealed)} · ${revealed.multiplier} เด้ง` : !p.connected ? 'กำลังเชื่อมต่อใหม่' : idle ? p.ready || p.id === s.hostId ? '● พร้อม' : 'รอพร้อม' : p.acted ? 'ตัดสินใจแล้ว' : 'รอตัดสินใจ'}{p.id !== s.dealerId && ` · วาง ${p.bet}`}</div>}
    {result && <div className={`result ${result.delta > 0 ? 'win' : result.delta < 0 ? 'lose' : ''}`}>{handLabel(result)} · {result.multiplier} เด้ง<br/>{result.caught && <button className="pok-caught-info" aria-label={'ดูผลจับ ' + p.name} onClick={showCatches}>{result.catchRecompared ? 'เทียบใหม่' : 'จับ'}</button>}{result.outcome === 'TIE' ? 'เสมอ' : result.outcome === 'DEALER' ? 'รวมเจ้ามือ' : result.outcome === 'WIN' ? 'ชนะ' : 'แพ้'} {result.delta > 0 ? '+' : ''}{result.delta}</div>}
  </article>;
}
function PokPanel({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="pok-dialog" aria-labelledby="pok-dialog-title" onCancel={close}>
    <div className="pok-dialog-header"><h2 id="pok-dialog-title">{title}</h2><button aria-label="ปิดหน้าต่าง" onClick={close}>✕</button></div>
    <div className="pok-dialog-body">{children}</div>
  </dialog>;
}
export function PlayPage({ state, code }: { state: SessionState; code: string }) {
  const [panel, setPanel] = useState<'rules' | 'table' | 'catches' | null>(null);
  const [catchTarget, setCatchTarget] = useState('');
  const s = state.snapshot;
  const now = useDeadlineNow(s?.deadline);
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' || state.status === 'connecting' ? 'กำลังกลับเข้าโต๊ะ…' : 'ยังไม่ได้เข้าห้องนี้'}</h1><p>ห้อง {code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/rooms/join?code=' + code)}>เข้าห้องนี้</button>}</main>;
  const me = s.players.find(p => p.id === state.playerId);
  const idle = s.phase === 'LOBBY' || s.phase === 'ROUND_END';
  const host = s.hostId === state.playerId; const dealer = s.dealerId === state.playerId;
  const active = state.status === 'connected';
  const canAct = active && me && !me.acted && now < s.deadline && ((s.phase === 'PLAYER_ACTIONS' && !dealer) || (s.phase === 'DEALER_ACTION' && dealer));
  const seconds = s.deadline ? Math.max(0, Math.min(Math.ceil(s.rules.actionMs / 1000), Math.ceil((s.deadline - now) / 1000))) : 0;
  const deciding = s.phase === 'PLAYER_ACTIONS' || s.phase === 'DEALER_ACTION';
  const opponents = [...s.players].filter(p => p.id !== state.playerId).sort((a,b) => a.seat - b.seat);
  const catches = s.catches ?? [];
  const catchable = s.players.filter(p => p.id !== s.dealerId && p.cardCount === 3 && !catches.some(r => r.id === p.id));
  const selectedCatch = catchable.find(p => p.id === catchTarget)?.id ?? catchable[0]?.id;
  const canCatch = canAct && dealer && me?.cardCount === 2 && catchable.length > 0;
  return (<main className="game pok-game">
      <div className="room-bar"><div className="pok-room-id"><BrandLogo compact/><strong>{s.code}</strong><CopyRoomCodeButton code={s.code}/></div><div className="pok-navigation"><span className="connection" aria-label={active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}><i className={active ? 'online' : ''}/><span>{active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}</span></span><button className="small" aria-label="กติกาป๊อกเด้ง" onClick={() => setPanel('rules')}>กติกา</button><button className="small" aria-label="จัดการโต๊ะป๊อกเด้ง" onClick={() => setPanel('table')}>โต๊ะ</button><button className="ghost small" onClick={() => session.leave()}>ออกจากห้อง</button></div></div>
      <div className="game-layout"><section className="table-area">
        <div className="phase"><span>{canAct && 'ถึงตาคุณ · '}{phaseLabel[s.phase]} · รอบ {s.roundId || '–'}</span><span className={'pok-clock' + (canAct ? ' is-own-turn' : '')}><span>{s.deadline > 0 ? `${seconds} วินาที · ` : ''}{s.players.length}/6 คน</span>{deciding && <span className="pok-time" role="progressbar" aria-label="เวลาตัดสินใจ" aria-valuemin={0} aria-valuemax={Math.ceil(s.rules.actionMs / 1000)} aria-valuenow={seconds}><i style={{width: Math.max(0,Math.min(100,(s.deadline - now) / s.rules.actionMs * 100)) + '%'}}/></span>}</span></div>
        <div className="table" data-players={s.players.length} data-opponents={opponents.length}><div className="table-mark" aria-hidden="true"><BrandLogo/><small>POK DENG</small></div>
          <div className="seats pok-table-seats"><div className="pok-opponents">{opponents.map(p => <PokSeat key={p.id} player={p} s={s} state={state} showCatches={() => setPanel('catches')}/>)}</div><section className="pok-turn-stage"><span className="eyebrow">{idle ? 'วงเซียน · POK DENG' : canAct ? 'ตาของคุณ' : 'กำลังเล่น'}</span><h1>{canAct ? dealer ? 'ตาเจ้ามือ' : 'เลือกอยู่หรือจั่วอีกใบ' : phaseLabel[s.phase]}</h1>{deciding && <><p>{canCatch ? 'เลือกจับผู้เล่นที่มี 3 ใบ จั่ว หรืออยู่' : 'เปิดไพ่พร้อมกันเมื่อทุกคนตัดสินใจแล้ว'}</p><strong className="club-stage-clock">00:{String(seconds).padStart(2,'0')}</strong></>}</section>{me && <section className="pok-self" aria-label="ไพ่ของคุณ"><PokSeat player={me} s={s} state={state} showCatches={() => setPanel('catches')}/></section>}</div>
        </div>
      </section></div>
      <section className="pok-action-dock" aria-label="การเล่นป๊อกเด้ง">
        <h2 className="desktop-only">การเล่นของคุณ</h2>
        {canCatch && <div className="pok-catch-controls"><ClubSelect<string> compact label="จับผู้เล่น 3 ใบ" value={selectedCatch??''} onChange={setCatchTarget} options={catchable.map(p=>({value:p.id,label:p.name}))}/><button disabled={!selectedCatch} onClick={() => session.send('catch', selectedCatch)}>จับด้วยไพ่ 2 ใบ</button></div>}
        {idle && me ? <div className="pok-round-controls">
          {!dealer && <div className="pok-bet-controls"><span>วางแต้ม</span><div className="bets">{s.rules.bets.map(bet => <button key={bet} className={me.bet === bet ? 'selected' : ''} disabled={!active} onClick={() => session.send('setBet', bet)}>{bet}</button>)}</div></div>}
          {host && <div className="pok-dealer-control"><ClubSelect<string> compact label="เจ้ามือ" disabled={!active} value={s.dealerId} onChange={value=>session.send('selectDealer',value)} options={s.players.filter(p=>p.connected).map(p=>({value:p.id,label:p.name}))}/></div>}
          {!host && <button className="primary" disabled={!active} onClick={() => session.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}
          {host && (s.phase === 'LOBBY' ? <button className="primary" disabled={!active || s.players.length < 2 || s.players.some(p => !p.connected || (p.id !== s.hostId && !p.ready))} onClick={() => session.send('startRound')}>เริ่มรอบ</button> : <button className="primary" disabled={!active} onClick={() => session.send('prepareRound')}>เตรียมรอบใหม่</button>)}
        </div> : <div className="action-bar">{canAct ? <><button className="ghost" onClick={() => session.send('stand')}>อยู่</button><button className="primary" onClick={() => session.send('draw')}>จั่วอีกใบ</button></> : <p>{me?.acted ? 'คุณตัดสินใจแล้ว รอสรุปผลรอบ' : 'รอจังหวะเล่นของคุณ'}</p>}</div>}
        {canCatch&&<p className="desktop-only pok-catch-note">จับแล้วเริ่มนับเวลาใหม่ 30 วินาที</p>}
      </section>
      {panel && <PokPanel title={panel === 'rules' ? 'กติกาป๊อกเด้ง' : panel === 'catches' ? 'ผลการจับ' : 'จัดการโต๊ะป๊อกเด้ง'} close={() => setPanel(null)}>
        {panel === 'rules' ? <Rules/> : panel === 'catches' ? <><p className="fine">จับด้วยไพ่เจ้ามือ 2 ใบ หากเจ้ามือจั่วแล้วได้ 8/9 แต้มปกติ จะเทียบผลจับใหม่ด้วยไพ่เจ้ามือ 3 ใบ ชำระแต้มพร้อมกันเมื่อจบรอบ</p>{catches.map(r => <section className="pok-catch-detail" key={r.id}><h3>{s.players.find(p => p.id === r.id)?.name ?? 'ผู้เล่น'}</h3><div className="pok-catch-hands"><div><small>เจ้ามือ · {r.dealerValue && handLabel(r.dealerValue)}{r.catchRecompared && ' · เทียบหลังจั่ว'}</small><div className="hand">{r.dealerCards?.map((card, i) => <Card key={i} card={card}/>)}</div></div><div><small>ผู้เล่น · {handLabel(r)}</small><div className="hand">{r.cards.map((card, i) => <Card key={i} card={card}/>)}</div></div></div><p>{r.outcome === 'TIE' ? 'เสมอ' : r.outcome === 'WIN' ? 'ผู้เล่นชนะ' : 'เจ้ามือชนะ'} · ผู้เล่น {r.delta > 0 ? '+' : ''}{r.delta} แต้ม</p></section>)}</> : <div className="pok-table-settings"><h2>โต๊ะของเรา <small>{s.players.length}/6 คน</small></h2>
        {host && s.phase === 'LOBBY' && <section className="bot-controls"><h3>เล่นกับบอท</h3><button className="ghost full" disabled={!active || s.players.length >= s.rules.maxPlayers} onClick={() => session.send('addBot')}>เพิ่มบอท</button>{s.players.filter(p => p.isBot).map(bot => <div className="bot-row" key={bot.id}><span>{bot.name}</span><button className="small" disabled={!active} aria-label={'นำ ' + bot.name + ' ออก'} onClick={() => session.send('removeBot', bot.id)}>นำออก</button></div>)}<p className="fine">บอทพร้อมเล่นอัตโนมัติ และเลือกเป็นเจ้ามือได้</p></section>}
        {host && s.phase === 'LOBBY' && <button className="ghost full" disabled={!active} onClick={() => session.send('resetTablePoints')}>รีเซ็ตทั้งโต๊ะเป็น 1,000 แต้ม</button>}
        <button className="ghost full" onClick={() => session.leave('/games')}>← กลับหน้าแรก</button><p className="fine">แต้มจำลอง ไม่มีมูลค่าเงินจริง<br/>ห้องและแต้มจะหายเมื่อ server restart</p></div>}
      </PokPanel>}
    </main>);
}
