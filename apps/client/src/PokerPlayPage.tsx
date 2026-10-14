import { useEffect, useState } from 'react';
import { pokerSession } from './session';
import type { SessionState } from './session';
import type { PokerSnapshot, PokerPlayer } from '../../../packages/shared/src/poker';
import { navigate } from './router';
import { Card } from './components';
import { PokerRules } from './PokerRules';
const stages = { LOBBY: 'รอผู้เล่นพร้อม', DEALING: 'กำลังแจกไพ่', PREFLOP: 'Pre-flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Showdown', ROUND_END: 'จบรอบ' };
function PokerSeat({ player: p, s, state }: { player: PokerPlayer; s: PokerSnapshot; state: SessionState<PokerSnapshot> }) {
  const own = p.id === state.playerId; const result = s.results.find(r => r.id === p.id);
  const cards = result?.cards.length ? result.cards : own && state.handRound === s.roundId ? state.hand : [];
  return <article className={`poker-seat ${own ? 'own' : ''} ${s.turnId === p.id ? 'on-turn' : ''} ${p.folded ? 'folded' : ''}`}>
    <div className="player-name">{p.name} {own && <small>คุณ</small>} {p.isBot && <span className="bot-badge">บอท</span>}</div>
    <div className="poker-badges">{s.buttonId === p.id && <span className="button-chip">D</span>}{s.smallBlindId === p.id && <span>SB</span>}{s.bigBlindId === p.id && <span>BB</span>}{p.allIn && <span className="all-in-tag">ALL-IN</span>}</div>
    <div className="hand">{p.inHand && [0, 1].map(i => <Card key={`${s.roundId}-${i}`} card={cards[i]} index={p.seat * 2 + i}/>)}</div>
    <div className="points">{p.points.toLocaleString()} <small>ชิป</small></div>
    <div className="player-status">{!p.connected ? 'กำลังเชื่อมต่อใหม่' : s.phase === 'LOBBY' ? p.points === 0 ? 'ไม่มีชิป / พัก' : p.ready || p.id === s.hostId ? '● พร้อม' : 'รอพร้อม' : p.lastAction || 'รอเล่น'}{p.streetBet > 0 && ` · วาง ${p.streetBet}`}</div>
    {result && <div className={`result ${result.delta > 0 ? 'win' : result.delta < 0 ? 'lose' : ''}`}>{result.handName}<br/>{result.delta > 0 ? '+' : ''}{result.delta} ชิป{result.payout > 0 && ` · รับ ${result.payout}`}</div>}
  </article>;
}
export function PokerPlayPage({ state, code }: { state: SessionState<PokerSnapshot>; code: string }) {
  const [now, setNow] = useState(Date.now()); const [raiseTo, setRaiseTo] = useState(40); const [copied, setCopied] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer); }, []);
  const s = state.snapshot;
  useEffect(() => { if (s) setRaiseTo(s.currentBet + s.minRaise); }, [s?.roundId, s?.phase, s?.currentBet, s?.minRaise]);
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' ? 'กำลังกลับเข้าโต๊ะ Poker…' : 'ยังไม่ได้เข้าห้อง Poker นี้'}</h1><p>{code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/poker/rooms/join?code=' + code)}>เข้าห้องนี้</button>}<button onClick={() => navigate('/games')}>เลือกเกม</button></main>;
  const me = s.players.find(p => p.id === state.playerId); const host = s.hostId === state.playerId;
  const active = state.status === 'connected'; const canAct = active && s.turnId === state.playerId && now < s.deadline;
  const call = me ? Math.max(0, s.currentBet - me.streetBet) : 0;
  const max = me ? me.streetBet + me.points : 0; const min = s.currentBet + s.minRaise;
  const raiseAllowed = s.raiseAllowedIds.includes(state.playerId);
  const seconds = Math.max(0, Math.min(Math.ceil(s.turnDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const bySeat = [...s.players].sort((a, b) => a.seat - b.seat);
  return <main className="game poker-game">
    <div className="room-bar"><div><span className="eyebrow">TEXAS HOLD’EM · NO-LIMIT · BLINDS 10/20</span><strong>{s.code}</strong><button className="small" onClick={async () => { try { await navigator.clipboard.writeText(s.code); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}</button></div><button className="ghost" onClick={() => pokerSession.leave()}>ออกจากห้อง</button></div>
    <div className="game-layout"><section className="table-area"><div className="phase"><span>{stages[s.phase]}</span><span>รอบ {s.roundId || '–'}{s.turnId && ` · ${seconds} วินาที`}</span></div>
      <div className={`poker-table ${s.phase === 'DEALING' ? 'dealing' : ''}`}>
        <div className="poker-opponents">{bySeat.filter(p => p.id !== state.playerId).map(p => <PokerSeat key={p.id} player={p} s={s} state={state}/>)}</div>
        <section className="poker-center"><div className="pot-display"><span className="chip-stack">●</span><span>POT<strong>{s.pot.toLocaleString()}</strong></span></div>
          <div className="community" aria-label="ไพ่กลาง">{Array.from({ length: 5 }, (_, i) => s.board[i] ? <div className="board-card" key={`${s.roundId}-${i}`}><Card card={s.board[i]} index={i}/></div> : <div key={`${s.roundId}-${i}`} className="card-slot"/>)}</div>
          {s.phase === 'DEALING' && <div className="deal-label" role="status">♠ กำลังแจกไพ่คนละ 2 ใบ…</div>}
          <div className="street-track">{['PREFLOP', 'FLOP', 'TURN', 'RIVER'].map(phase => <span className={s.phase === phase ? 'current' : ''} key={phase}>{phase === 'PREFLOP' ? 'Pre-flop' : phase.charAt(0) + phase.slice(1).toLowerCase()}</span>)}</div>
        </section>
        {me && <div className="poker-self"><PokerSeat player={me} s={s} state={state}/></div>}
      </div>
      {s.turnId && <div className="turn-banner" role="status">{canAct ? 'ถึงตาคุณ' : `รอ ${s.players.find(p => p.id === s.turnId)?.name}`} · {seconds} วินาที<div className="turn-time"><i style={{ width: `${Math.max(0, Math.min(100, (s.deadline - now) / s.turnDurationMs * 100))}%` }}/></div></div>}
      {canAct && me && <section className="poker-actions"><div className="quick-actions"><button className="fold-button" onClick={() => pokerSession.send('fold')}>Fold / หมอบ</button>{call === 0 ? <button onClick={() => pokerSession.send('check')}>Check / ผ่าน</button> : <button className="primary" onClick={() => pokerSession.send('call')}>Call {Math.min(call, me.points)}</button>}<button disabled={max > s.currentBet && !raiseAllowed} onClick={() => pokerSession.send('allIn')}>All-in {me.points}</button></div>
        {raiseAllowed && max > s.currentBet && <div className="raise-panel"><p className="raise-hint">เลือกชิปที่เพิ่มจากยอดเดิมพันโต๊ะ {s.currentBet}</p><div className="raise-chips" aria-label="เลือกชิป Raise">{[10,20,50,100,200].map(chip => {
          const target = s.currentBet + chip;
          const valid = target <= max && (chip >= s.minRaise || target === max);
          return <button key={chip} type="button" className={`chip-choice chip-${chip} ${raiseTo === target ? 'selected' : ''}`} aria-label={`Raise เพิ่ม ${chip}`} aria-pressed={raiseTo === target} title={!valid ? target > max ? 'ชิปไม่พอ' : `Raise ขั้นต่ำเพิ่ม ${s.minRaise}` : `Raise รวมเป็น ${target}`} disabled={!valid} onClick={() => setRaiseTo(target)}>{chip}</button>;
        })}<button type="button" className={`chip-all-in ${raiseTo === max ? 'selected' : ''}`} aria-label="เลือก All-in" aria-pressed={raiseTo === max} onClick={() => setRaiseTo(max)}>All-in</button></div>
          <div className="raise-controls"><label>Raise รวมเป็น<input type="number" min={Math.min(min, max)} max={max} step="1" value={raiseTo} onChange={e => setRaiseTo(Number(e.target.value))}/></label><button className="primary" disabled={!Number.isSafeInteger(raiseTo) || raiseTo > max || raiseTo <= s.currentBet || (raiseTo < min && raiseTo !== max)} onClick={() => pokerSession.send(raiseTo === max ? 'allIn' : 'raise', raiseTo)}>{raiseTo === max ? 'ยืนยัน All-in' : 'ยืนยัน Raise'}</button><small>ขั้นต่ำรวม {min} · สูงสุด {max}</small></div>
          <p className="raise-summary">Call {call} + Raise {Math.max(0, raiseTo - s.currentBet)} · จ่ายเพิ่ม {Math.max(0, raiseTo - me.streetBet)} ชิป · รวมเดิมพันตานี้ {raiseTo}</p>
        </div>}
      </section>}
    </section><aside className="controls"><h2>Poker <small>{s.players.length}/6 คน</small></h2><p className="muted">ไพ่ส่วนตัว 2 ใบ + ไพ่กลาง 5 ใบ<br/>เลือกมือดีที่สุด 5 ใบ</p>
      {s.phase === 'LOBBY' && me && <>{host ? <><button className="primary full" disabled={!active || s.players.filter(p => p.points > 0).length < 2 || s.players.some(p => !p.connected || (p.points > 0 && p.id !== s.hostId && !p.ready))} onClick={() => pokerSession.send('startRound')}>เริ่มรอบ Poker</button><button className="ghost full" disabled={!active || s.players.length >= 6} onClick={() => pokerSession.send('addBot')}>เพิ่มบอท</button>{s.players.filter(p => p.isBot).map(p => <div className="bot-row" key={p.id}><span>{p.name}</span><button className="small" disabled={!active} onClick={() => pokerSession.send('removeBot', p.id)}>นำออก</button></div>)}<button className="ghost full" disabled={!active} onClick={() => pokerSession.send('resetTablePoints')}>รีเซ็ตทั้งโต๊ะ 1,000 ชิป</button></> : <button className="primary full" disabled={!active || me.points === 0} onClick={() => pokerSession.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}</>}
      {s.phase === 'ROUND_END' && host && <button className="primary full" disabled={!active} onClick={() => pokerSession.send('prepareRound')}>เตรียมรอบใหม่</button>}
      {s.pots.length > 0 && <div className="pot-results"><h3>สรุป Pot</h3>{s.pots.map((p, i) => <p key={i}><b>{p.refund ? 'คืนส่วนที่ไม่มีคนรับ' : i === 0 ? 'Main pot' : 'Side pot'} · {p.amount}</b><br/>{p.winners.map(id => s.players.find(player => player.id === id)?.name ?? 'ผู้เล่น').join(', ')}</p>)}</div>}
      <PokerRules/><div className="connection"><i className={active ? 'online' : ''}/>{active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}</div><p className="fine">ชิปจำลอง ไม่มีมูลค่าเงินจริง<br/>ห้องและชิปหายเมื่อ server restart</p>
    </aside></div>
  </main>;
}
