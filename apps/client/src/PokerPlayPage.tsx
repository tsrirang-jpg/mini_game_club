import { SpyfallSelect as ClubSelect } from './SpyfallSelect';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { pokerSession } from './session';
import type { SessionState } from './session';
import type { PokerSnapshot, PokerPlayer } from '../../../packages/shared/src/poker';
import { pokerPotSummaries } from '../../../packages/shared/src/poker';
import { navigate } from './router';
import { Card } from './components';
import { PokerRules } from './PokerRules';

const stages = { LOBBY: 'รอผู้เล่นพร้อม', DEALING: 'กำลังแจกไพ่', PREFLOP: 'Pre-flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Showdown', ROUND_END: 'จบรอบ' };
type Panel = 'rules' | 'table' | 'results' | 'pots' | 'close';
const potLabel = (pots: { refund: boolean }[], i: number) => pots[i].refund ? 'คืนชิป' :
  pots.slice(0, i).filter(p => !p.refund).length === 0 ? 'Main Pot' : 'Side Pot ' + pots.slice(0, i).filter(p => !p.refund).length;

function PokerSeat({ player: p, s, state, now }: { player: PokerPlayer; s: PokerSnapshot; state: SessionState<PokerSnapshot>; now: number }) {
  const own = p.id === state.playerId;
  const result = s.results.find(r => r.id === p.id);
  const cards = result?.cards.length ? result.cards : own && state.handRound === s.roundId ? state.hand : [];
  return <article aria-label={'ผู้เล่น ' + p.name} className={'poker-seat ' + (own ? 'own ' : '') + (s.turnId === p.id ? 'on-turn ' : '') + (p.folded ? 'folded' : '')}>
    <div className="player-name" title={p.name}><span className="poker-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span><span className="seat-number">#{p.seat + 1}</span> {p.name} {own && <small>คุณ</small>} {p.isBot && <span className="bot-badge">บอท</span>}</div>
    <div className="poker-badges">{s.buttonId === p.id && <span className="button-chip">D</span>}{s.smallBlindId === p.id && <span>SB</span>}{s.bigBlindId === p.id && <span>BB</span>}{p.allIn && <span className="all-in-tag">ALL-IN</span>}</div>
    <div className="hand">{p.inHand && [0, 1].map(i => <Card key={s.roundId + '-' + i} card={cards[i]} index={p.seat * 2 + i}/>)}</div>
    <div className="points">{p.points.toLocaleString()} <small>ชิป</small></div>
    {!result && <div className="player-status" title={p.lastAction}>{!p.connected ? p.reconnectUntil > now ? 'Reconnect ' + Math.ceil((p.reconnectUntil - now) / 1000) + 's' : 'ออกจากห้องแล้ว' : s.phase === 'LOBBY' ? p.points === 0 ? 'ไม่มีชิป / พัก' : p.ready || p.id === s.hostId ? '● พร้อม' : 'รอพร้อม' : p.lastAction || 'รอเล่น'}{p.streetBet > 0 && ' · วาง ' + p.streetBet}</div>}
    {result && <div title={result.handName + ' · ' + result.delta + ' ชิป · รับ ' + result.payout} className={'result ' + (result.delta > 0 ? 'win' : result.delta < 0 ? 'lose' : '')}><span>{result.handName}</span> <b>{result.delta > 0 ? '+' : ''}{result.delta}</b></div>}
  </article>;
}

function PokerPanel({ panel, close, children }: { panel: Panel; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  const title = panel === 'close' ? 'ปิดห้องสำหรับทุกคน' : panel === 'rules' ? 'กติกา Poker' : panel === 'table' ? 'จัดการโต๊ะ' : panel === 'pots' ? 'แบ่ง POT' : 'ผลรอบและสรุป Pot';
  return <dialog ref={ref} className="poker-dialog" aria-labelledby="poker-dialog-title" onCancel={close}>
    <div className="poker-dialog-header"><h2 id="poker-dialog-title">{title}</h2><button aria-label="ปิดหน้าต่าง" onClick={close}>✕</button></div>
    <div className="poker-dialog-body">{children}</div>
  </dialog>;
}

export function PokerPlayPage({ state, code }: { state: SessionState<PokerSnapshot>; code: string }) {
  const [now, setNow] = useState(Date.now());
  const [raiseTo, setRaiseTo] = useState(40);
  const [copied, setCopied] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [hostNotice, setHostNotice] = useState('');
  const lastHost = useRef<string | undefined>(undefined);
  const [cardSize, setCardSize] = useState<'normal' | 'high'>(() => localStorage.getItem('poker.cardSize') === 'normal' ? 'normal' : 'high');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(timer); }, []);
  const s = state.snapshot;
  useEffect(() => {
    if (!s) return;
    const changed = lastHost.current !== undefined && lastHost.current !== s.hostId;
    lastHost.current = s.hostId;
    if (!changed || !s.hostId) return;
    setHostNotice('Host เปลี่ยนเป็น ' + (s.players.find(p => p.id === s.hostId)?.name ?? 'ผู้เล่น'));
    const timer = setTimeout(() => setHostNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [s?.hostId]);
  useEffect(() => { if (s) setRaiseTo(s.currentBet + s.minRaise); }, [s?.roundId, s?.phase, s?.currentBet, s?.minRaise]);
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' ? 'กำลังกลับเข้าโต๊ะ Poker…' : 'ยังไม่ได้เข้าห้อง Poker นี้'}</h1><p>{code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/poker/rooms/join?code=' + code)}>เข้าห้องนี้</button>}<button onClick={() => navigate('/games')}>เลือกเกม</button></main>;
  const me = s.players.find(p => p.id === state.playerId), host = s.hostId === state.playerId;
  const active = state.status === 'connected', canAct = active && s.turnId === state.playerId && now < s.deadline;
  const call = me ? Math.max(0, s.currentBet - me.streetBet) : 0;
  const max = me ? me.streetBet + me.points : 0, min = s.currentBet + s.minRaise;
  const raiseAllowed = s.raiseAllowedIds.includes(state.playerId);
  const seconds = Math.max(0, Math.min(Math.ceil(s.turnDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const bySeat = [...s.players].sort((a, b) => a.seat - b.seat);
  const pots = pokerPotSummaries(s.pots);
  const myResult = s.results.find(r => r.id === state.playerId);
  const canShowCards = s.phase === 'ROUND_END' && myResult?.cards.length === 0
    && s.pots.some(pot => !pot.refund && pot.winners.includes(state.playerId));
  const playerName = (id: string) => s.players.find(p => p.id === id)?.name ?? s.results.find(r => r.id === id)?.name ?? 'ผู้เล่นที่ออกแล้ว';
  const playerLabel = (id: string) => { const p = s.players.find(p => p.id === id); return p ? '#' + (p.seat + 1) + ' ' + p.name : playerName(id); };
  const seatName = (id: string) => { const p = s.players.find(p => p.id === id); return p ? '#' + (p.seat + 1) : playerName(id); };
  const potDetails = <div className="pot-results"><p className="pot-explanation">{s.results.length ? 'แบ่งกองตามเงินที่ลง ผู้ชนะรับเฉพาะกองที่มีสิทธิ์' : 'ยอดแต่ละกองอัปเดตตามเดิมพัน ยังไม่ตัดสินผู้ชนะ'}</p>{pots.map((p, i) => <section className="pot-detail" key={i}>
    <h3>{potLabel(pots, i)} <strong>{p.amount.toLocaleString()} ชิป</strong></h3>
    {p.refund ? <p>เงินเดิมพันส่วนที่ไม่มีคนรับ คืนให้เจ้าของ</p> : <p className="pot-eligible">มีสิทธิ์: {p.eligible.map(playerLabel).join(', ')}</p>}
    {p.winners.length ? <ul className="pot-awards">{p.winners.map(id => <li key={id}><span>{playerLabel(id)}</span><b>{p.refund ? 'คืน ' : 'รับ '}{p.awards[id].toLocaleString()} ชิป</b></li>)}</ul> : <p className="muted">รอเปิดไพ่หรือผู้เล่นคนอื่นหมอบ</p>}
  </section>)}</div>;
  const playing = !['LOBBY', 'ROUND_END'].includes(s.phase);
  const canStart = active && !s.roomClosing && s.players.filter(p => p.points > 0).length >= 2 && !s.players.some(p => !p.connected || (p.points > 0 && p.id !== s.hostId && !p.ready));
  return <main className={'game poker-game card-size-' + cardSize + ' ' + (playing ? 'hand-active' : 'hand-idle') + (pots.length > 1 ? ' has-side-pots' : '')}>
    <div className="room-bar">
      <div className="poker-room-id"><span className="poker-wordmark">♠ <span>Poker</span></span><strong>{s.code}</strong><button className="small" aria-label="คัดลอกรหัสห้อง" onClick={async () => { try { await navigator.clipboard.writeText(s.code); setCopied(true); } catch { setCopied(false); } }}>{copied ? '✓' : 'คัดลอก'}</button></div>
      <div className="poker-tools"><span className="connection" aria-label={active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}><i className={active ? 'online' : ''}/><span className="connection-label">{active ? 'เชื่อมต่อแล้ว' : 'เชื่อมต่อใหม่'}</span></span><button className="small" aria-label="กติกา Poker" onClick={() => setPanel('rules')}>กติกา</button><button className="small" aria-label="จัดการโต๊ะ" onClick={() => setPanel('table')}>โต๊ะ</button><button className="ghost small" onClick={() => pokerSession.leave()}>ออกจากห้อง</button></div>
    </div>
    <div className="game-layout"><section className="table-area">
      <div className="phase"><span>{stages[s.phase]} <small>· รอบ {s.roundId || '–'} · Host: {s.hostId ? playerName(s.hostId) : 'รอเชื่อมต่อ'}</small></span>{s.turnId ? <div className="turn-banner" role="status">{canAct ? 'ถึงตาคุณ' : 'รอ ' + s.players.find(p => p.id === s.turnId)?.name} · {seconds} วินาที<div className="turn-time"><i style={{ width: Math.max(0, Math.min(100, (s.deadline - now) / s.turnDurationMs * 100)) + '%' }}/></div></div> : <span className="poker-table-info">{s.players.length}/6 คน · Blinds 10/20</span>}</div>
      <div data-opponents={bySeat.filter(p => p.id !== state.playerId).length} className={'poker-table ' + (s.phase === 'DEALING' ? 'dealing' : '')}>
        {(s.roomClosing || hostNotice) && <div className="poker-room-notice" role="status">{s.roomClosing ? s.closeAt ? 'ปิดห้องใน ' + Math.max(0, Math.ceil((s.closeAt - now) / 1000)) + ' วินาที' : 'Host จะปิดห้องหลังจบรอบนี้' : hostNotice}</div>}
        <div className="poker-bank">{pots.length > 1 && <section className="pot-breakdown" aria-label="กองเดิมพันแยก"><div className="pot-grid">{pots.map((p, i) => <button key={i} className={'pot-entry ' + (p.refund ? 'pot-refund' : i ? 'pot-side' : 'pot-main')} aria-label={potLabel(pots, i) + ' ' + p.amount + ' ชิป'} title={(p.winners.length ? 'รับ: ' + p.winners.map(id => playerName(id) + ' ' + p.awards[id]).join(', ') : 'มีสิทธิ์: ' + p.eligible.map(playerName).join(', '))} onClick={() => setPanel('pots')}>
            <span className="pot-title">{potLabel(pots, i)}</span><span className="pot-title-short" aria-hidden="true">{p.refund ? 'คืน' : potLabel(pots, i) === 'Main Pot' ? 'Main' : 'S' + pots.slice(0, i).filter(pot => !pot.refund).length}</span><strong>{p.amount.toLocaleString()}</strong><small className="pot-players">{p.winners.length ? p.winners.map(id => seatName(id) + ' +' + p.awards[id].toLocaleString()).join(' · ') : 'สิทธิ์ ' + p.eligible.map(seatName).join(' ')}</small>
          </button>)}</div></section>}</div>
        <div className="poker-opponents">{bySeat.filter(p => p.id !== state.playerId).map(p => <PokerSeat key={p.id} player={p} s={s} state={state} now={now}/>)}

        </div>
        <section className="poker-center">
          <div className="pot-display"><span className="chip-stack">●</span><span>POT <strong>{s.pot.toLocaleString()}</strong></span></div>
          <div className="community" aria-label="ไพ่กลาง">{Array.from({ length: 5 }, (_, i) => s.board[i] ? <div className="board-card" key={s.roundId + '-' + i}><Card card={s.board[i]} index={i}/></div> : <div key={s.roundId + '-' + i} className="card-slot"/>)}</div>
          {s.phase === 'DEALING' && <div className="deal-label" role="status">♠ กำลังแจกไพ่คนละ 2 ใบ…</div>}
          <div className="street-track">{['PREFLOP', 'FLOP', 'TURN', 'RIVER'].map(phase => <span className={s.phase === phase ? 'current' : ''} key={phase}>{phase === 'PREFLOP' ? 'Pre-flop' : phase.charAt(0) + phase.slice(1).toLowerCase()}</span>)}</div>
        </section>
        {me && <div className="poker-self"><PokerSeat player={me} s={s} state={state} now={now}/></div>}
      </div>
    </section></div>
    <div className="poker-action-dock" aria-label="การเล่นและเดิมพัน">
      {canShowCards && <button className="show-cards-button" disabled={!active} onClick={() => pokerSession.send('showCards')}>Show cards / เปิดไพ่</button>}
      {canAct && me ? <section className="poker-actions">
        <div className="quick-actions"><button className="fold-button" onClick={() => pokerSession.send('fold')}>Fold / หมอบ</button>{call === 0 ? <button onClick={() => pokerSession.send('check')}>Check / ผ่าน</button> : <button className="primary" onClick={() => pokerSession.send('call')}>Call {Math.min(call, me.points)}</button>}<button disabled={max > s.currentBet && !raiseAllowed} onClick={() => pokerSession.send('allIn')}>All-in {me.points}</button></div>
        {raiseAllowed && max > s.currentBet && <div className="raise-panel">
          <p className="raise-hint">เพิ่มจากยอดโต๊ะ {s.currentBet} · ขั้นต่ำ +{s.minRaise}</p>
          <div className="raise-chips" aria-label="เลือกชิป Raise">{[10,20,50,100,200].map(chip => {
            const target = s.currentBet + chip, valid = target <= max && (chip >= s.minRaise || target === max);
            return <button key={chip} type="button" className={'chip-choice chip-' + chip + (raiseTo === target ? ' selected' : '')} aria-label={'Raise เพิ่ม ' + chip} aria-pressed={raiseTo === target} title={!valid ? target > max ? 'ชิปไม่พอ' : 'Raise ขั้นต่ำเพิ่ม ' + s.minRaise : 'Raise รวมเป็น ' + target} disabled={!valid} onClick={() => setRaiseTo(target)}>{chip}</button>;
          })}<button type="button" className={'chip-all-in ' + (raiseTo === max ? 'selected' : '')} aria-label="เลือก All-in" aria-pressed={raiseTo === max} onClick={() => setRaiseTo(max)}>All-in</button></div>
          <div className="raise-controls"><label>Raise รวมเป็น<input inputMode="numeric" type="number" min={Math.min(min, max)} max={max} step="1" value={raiseTo} onChange={e => setRaiseTo(Number(e.target.value))}/></label><button className="primary" disabled={!Number.isSafeInteger(raiseTo) || raiseTo > max || raiseTo <= s.currentBet || (raiseTo < min && raiseTo !== max)} onClick={() => pokerSession.send(raiseTo === max ? 'allIn' : 'raise', raiseTo)}>{raiseTo === max ? 'ยืนยัน All-in' : 'ยืนยัน Raise'}</button><small>ขั้นต่ำรวม {min} · สูงสุด {max}</small></div>
          <p className="raise-summary">Call {call} + Raise {Math.max(0, raiseTo - s.currentBet)} · จ่ายเพิ่ม {Math.max(0, raiseTo - me.streetBet)} ชิป · รวมเดิมพันตานี้ {raiseTo}</p>
        </div>}
      </section> : <div className="poker-dock-idle">
        {s.phase === 'LOBBY' && me ? <>{host ? <><button className="primary" disabled={!canStart} onClick={() => pokerSession.send('startRound')}>เริ่มรอบ Poker</button><button disabled={!active || s.players.length >= 6} onClick={() => pokerSession.send('addBot')}>เพิ่มบอท</button></> : <button className="primary" disabled={!active || me.points === 0} onClick={() => pokerSession.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}<span>พร้อมแล้ว {s.players.filter(p => p.ready || p.id === s.hostId).length}/{s.players.length} คน</span></> : s.phase === 'ROUND_END' ? <>{host && <button className="primary" disabled={!active} onClick={() => pokerSession.send('prepareRound')}>เตรียมรอบใหม่</button>}<button onClick={() => setPanel('results')}>ดูผลและสรุป Pot</button></> : <p>{s.phase === 'DEALING' ? 'กำลังแจกไพ่…' : me?.folded ? 'คุณหมอบแล้ว · รอผลรอบนี้' : me?.allIn ? 'คุณ All-in แล้ว · รอเปิดไพ่' : 'รอผู้เล่นคนอื่น · ปุ่มเดิมพันจะแสดงเมื่อถึงตาคุณ'}</p>}
      </div>}
    </div>
    {panel && <PokerPanel panel={panel} close={() => setPanel(null)}>
      {panel === 'close' ? <><p>{playing ? 'ห้องจะปิดหลังจบรอบและแจกชิปครบแล้ว ทุกคนมีเวลา 8 วินาทีดูผลก่อนกลับหน้าสร้างห้อง' : 'ทุกคนจะออกจากห้องใน 8 วินาที และรหัสห้องนี้จะใช้ไม่ได้อีก'}</p><p>หากต้องการออกคนเดียว ให้ใช้ปุ่ม “ออกจากห้อง” ระบบจะย้าย Host ให้คนที่เหลือ</p><div className="poker-close-actions"><button onClick={() => setPanel('table')}>ยกเลิก</button><button className="fold-button" disabled={!host || !active || s.roomClosing} onClick={() => { pokerSession.send('closeRoom'); setPanel(null); }}>ยืนยันปิดห้อง</button></div></> : panel === 'rules' ? <PokerRules/> : panel === 'pots' ? potDetails : panel === 'table' ? <>
        <p className="muted">{s.players.length}/6 คน · Blinds 10/20 · ชิปจำลอง</p>
        <ClubSelect<string> label="ขนาดไพ่บนจอคอม" value={cardSize} options={[{value:'high',label:'ใหญ่ (High)'},{value:'normal',label:'ปกติ'}]} onChange={value=>{const size=value==='normal'?'normal':'high';setCardSize(size);localStorage.setItem('poker.cardSize',size);}}/>
        {host && <><h3>บอทในโต๊ะ</h3>{s.players.filter(p => p.isBot).map(p => <div className="bot-row" key={p.id}><span>{p.name}</span><button className="small" disabled={!active || s.phase !== 'LOBBY'} onClick={() => pokerSession.send('removeBot', p.id)}>นำออก</button></div>)}<button className="ghost full" disabled={!active || s.phase !== 'LOBBY'} onClick={() => pokerSession.send('resetTablePoints')}>รีเซ็ตทั้งโต๊ะ 1,000 ชิป</button></>}
        <p className="fine">ปรับบอทและรีเซ็ตชิปได้ก่อนเริ่มรอบ<br/>ห้องและชิปหายเมื่อ server restart</p>
        <p className="fine">เน็ตหลุดหรือรีเฟรช กลับเข้าโต๊ะเดิมได้ภายใน 60 วินาที โดยเวลาตายังเดินต่อ<br/>กดออกจากห้องจะไม่ reconnect และย้าย Host ให้คนที่เหลือ</p>
        {host && <button className="ghost full" disabled={!active || s.roomClosing} onClick={() => setPanel('close')}>{s.roomClosing ? 'กำลังปิดห้อง' : 'ปิดห้องสำหรับทุกคน'}</button>}
      </> : <><div className="poker-result-list">{s.results.map(r => <p key={r.id}><strong>{playerName(r.id)}</strong><span>{r.handName} · {r.delta > 0 ? '+' : ''}{r.delta} ชิป · รับ {r.payout}</span></p>)}</div>{potDetails}</>}
    </PokerPanel>}
  </main>;
}
