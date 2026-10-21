import { BrandLogo } from './components/ui/BrandLogo';
import { useDeadlineNow } from './hooks/useDeadlineNow';
import { usePokerRaiseInput } from './hooks/usePokerRaiseInput';
import { usePokerDesktopLayout } from './hooks/usePokerDesktopLayout';
import { PokerTurnTimer } from './components/poker/PokerTurnTimer';
import { CopyRoomCodeButton } from './components/ui/CopyRoomCodeButton';
import { SpyfallSelect as ClubSelect } from './SpyfallSelect';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { pokerSession } from './session';
import type { SessionState } from './session';
import type { PokerSnapshot } from '../../../packages/shared/src/poker';
import { pokerPotSummaries } from '../../../packages/shared/src/poker';
import { navigate } from './router';
import { Card } from './components';
import { PokerRules } from './PokerRules';
import { PokerSeat } from './components/poker/PokerSeat';
import { PokerPotRail, pokerPotLabel as potLabel } from './components/poker/PokerPotRail';
import { ChipStack, PokerIcon } from './components/poker/PokerArtwork';

const stages = { LOBBY: 'รอผู้เล่นพร้อม', DEALING: 'กำลังแจกไพ่', PREFLOP: 'Pre-flop', FLOP: 'Flop', TURN: 'Turn', RIVER: 'River', SHOWDOWN: 'Showdown', ROUND_END: 'จบรอบ' };
type Panel = 'rules' | 'table' | 'results' | 'pots' | 'close';
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
  const desktop = usePokerDesktopLayout();
  const { value: raiseValue, amount: raiseTo, setAmount: setRaiseTo, onChange: handleRaiseChange } = usePokerRaiseInput();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [hostNotice, setHostNotice] = useState('');
  const lastHost = useRef<string | undefined>(undefined);
  const [cardSize, setCardSize] = useState<'normal' | 'high'>(() => localStorage.getItem('poker.cardSize') === 'normal' ? 'normal' : 'high');
  const s = state.snapshot;
  const now = useDeadlineNow(s?.deadline);
  useEffect(() => {
    if (!s) return;
    const changed = lastHost.current !== undefined && lastHost.current !== s.hostId;
    lastHost.current = s.hostId;
    if (!changed || !s.hostId) return;
    setHostNotice('Host เปลี่ยนเป็น ' + (s.players.find(p => p.id === s.hostId)?.name ?? 'ผู้เล่น'));
    const timer = setTimeout(() => setHostNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [s?.hostId]);
  useEffect(() => { if (s) setRaiseTo(s.currentBet + s.minRaise); }, [s?.roundId, s?.phase, s?.currentBet, s?.minRaise, setRaiseTo]);
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' ? 'กำลังกลับเข้าโต๊ะ Poker…' : 'ยังไม่ได้เข้าห้อง Poker นี้'}</h1><p>{code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/poker/rooms/join?code=' + code)}>เข้าห้องนี้</button>}</main>;
  const me = s.players.find(p => p.id === state.playerId), host = s.hostId === state.playerId;
  const active = state.status === 'connected', canAct = active && s.turnId === state.playerId && now < s.deadline;
  const call = me ? Math.max(0, s.currentBet - me.streetBet) : 0;
  const max = me ? me.streetBet + me.points : 0, min = s.currentBet + s.minRaise;
  const raiseAllowed = s.raiseAllowedIds.includes(state.playerId);
  const seconds = Math.max(0, Math.min(Math.ceil(s.turnDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const bySeat = [...s.players].sort((a, b) => a.seat - b.seat);
  const pots = pokerPotSummaries(s.pots);
  const contestedPot = s.pot - pots.filter(pot => pot.refund).reduce((sum, pot) => sum + pot.amount, 0);
  const myResult = s.results.find(r => r.id === state.playerId);
  const canShowCards = s.phase === 'ROUND_END' && myResult?.cards.length === 0
    && s.pots.some(pot => !pot.refund && pot.winners.includes(state.playerId));
  const playerName = (id: string) => s.players.find(p => p.id === id)?.name ?? s.results.find(r => r.id === id)?.name ?? 'ผู้เล่นที่ออกแล้ว';
  const playerLabel = (id: string) => { const p = s.players.find(p => p.id === id); return p ? '#' + (p.seat + 1) + ' ' + p.name : playerName(id); };
  const potDetails = <div className="pot-results"><p className="pot-explanation">{s.results.length ? 'แบ่งกองตามเงินที่ลง ผู้ชนะรับเฉพาะกองที่มีสิทธิ์' : 'ยอดแต่ละกองอัปเดตตามเดิมพัน ยังไม่ตัดสินผู้ชนะ'}</p>{pots.map((p, i) => <section className="pot-detail" key={i}>
    <h3>{potLabel(pots, i)} <strong>{p.amount.toLocaleString()} ชิป</strong></h3>
    {p.refund ? <p>เงินเดิมพันส่วนที่ไม่มีคนรับ คืนให้เจ้าของ</p> : <p className="pot-eligible">มีสิทธิ์: {p.eligible.map(playerLabel).join(', ')}</p>}
    {p.winners.length ? <ul className="pot-awards">{p.winners.map(id => <li key={id}><span>{playerLabel(id)}</span><b>{p.refund ? 'คืน ' : 'รับ '}{p.awards[id].toLocaleString()} ชิป</b></li>)}</ul> : <p className="muted">รอเปิดไพ่หรือผู้เล่นคนอื่นหมอบ</p>}
  </section>)}</div>;
  const currentStreet = ['SHOWDOWN', 'ROUND_END'].includes(s.phase)
    ? s.board.length === 5 ? 'RIVER' : s.board.length === 4 ? 'TURN' : s.board.length === 3 ? 'FLOP' : 'PREFLOP' : s.phase;
  const playing = !['LOBBY', 'ROUND_END'].includes(s.phase);
  const canStart = active && !s.roomClosing && s.players.filter(p => p.points > 0).length >= 2 && !s.players.some(p => !p.connected || (p.points > 0 && p.id !== s.hostId && !p.ready));
  const ownSeat = me && <div className="poker-self"><PokerSeat player={me} snapshot={s} state={state} now={now} turnLabel={desktop && canAct ? 'ถึงตาคุณ' : undefined}/></div>;
  const turnBanner = s.turnId && <PokerTurnTimer label={canAct ? 'ถึงตาคุณ' : 'รอ ' + playerName(s.turnId)} seconds={seconds} progress={(s.deadline - now) / s.turnDurationMs * 100}/>;
  return <main className={'game poker-game midnight-arena ' + (desktop ? 'clean-row-desktop ' : '') + 'card-size-' + cardSize + ' ' + (playing ? 'hand-active' : 'hand-idle')}>
    <div className="room-bar">
      <div className="poker-room-id"><BrandLogo compact/><span className="room-code-label">รหัสห้อง</span><strong>{s.code}</strong><CopyRoomCodeButton code={s.code}/></div>
      <div className="poker-tools"><span className="poker-header-meta">{s.players.length}/6 คน <span>· Blinds 10/20</span></span><span className="connection" aria-label={active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}><i className={active ? 'online' : ''}/><span className="connection-label">{active ? 'เชื่อมต่อแล้ว' : 'เชื่อมต่อใหม่'}</span></span><button className="small" aria-label="กติกา Poker" onClick={() => setPanel('rules')}><PokerIcon name="rules"/>กติกา</button><button className="small" aria-label="จัดการโต๊ะ" onClick={() => setPanel('table')}><PokerIcon name="table"/>โต๊ะ</button><button className="ghost small" onClick={() => pokerSession.leave()}><PokerIcon name="leave"/><span>ออกจากห้อง</span></button></div>
    </div>
    <div className="game-layout"><section className="table-area">
      <div className="phase"><span>{s.phase === 'DEALING' ? <span className="deal-label" role="status">♠ กำลังแจกไพ่คนละ 2 ใบ…</span> : <>{stages[s.phase]} <small>· รอบ {s.roundId || '–'} · Host: {s.hostId ? playerName(s.hostId) : 'รอเชื่อมต่อ'}</small></>}</span>{!desktop && s.turnId ? turnBanner : <span className="poker-table-info">{s.players.length}/6 คน · Blinds 10/20</span>}</div>
      <div data-opponents={bySeat.filter(p => p.id !== state.playerId).length} className={'poker-table ' + (s.phase === 'DEALING' ? 'dealing' : '')}>
        {(s.roomClosing || hostNotice) && <div className="poker-room-notice" role="status">{s.roomClosing ? s.closeAt ? 'ปิดห้องใน ' + Math.max(0, Math.ceil((s.closeAt - now) / 1000)) + ' วินาที' : 'Host จะปิดห้องหลังจบรอบนี้' : hostNotice}</div>}
        <div className="poker-opponents">{bySeat.filter(p => p.id !== state.playerId).map(p => <PokerSeat key={p.id} player={p} snapshot={s} state={state} now={now}/>)}

        </div>
        <section className="poker-center"><div className="arena-stage"><span/>{s.phase === 'LOBBY' ? 'TEXAS HOLD’EM' : s.phase === 'ROUND_END' ? 'รอบจบแล้ว' : stages[s.phase]}</div>
          <button type="button" className="pot-display" aria-label={'ดูรายละเอียด POT ' + contestedPot + ' ชิป'} onClick={() => setPanel('pots')}><ChipStack className="chip-stack"/><span>POT <strong>{contestedPot.toLocaleString()}</strong></span></button>
          <div className="community" aria-label="ไพ่กลาง">{Array.from({ length: 5 }, (_, i) => s.board[i] ? <div className="board-card" key={s.roundId + '-' + i}><Card card={s.board[i]} index={i}/></div> : <div key={s.roundId + '-' + i} className="card-slot"/>)}</div>
          <div className="street-track">{['PREFLOP', 'FLOP', 'TURN', 'RIVER'].map(phase => <span className={currentStreet === phase ? 'current' : ''} key={phase}>{phase === 'PREFLOP' ? 'Pre-flop' : phase.charAt(0) + phase.slice(1).toLowerCase()}</span>)}</div>
        </section>
        <div className="poker-bank"><PokerPotRail pots={pots} playerName={playerName} onDetails={() => setPanel('pots')}/></div>
        {!desktop && ownSeat}
      </div>
    </section></div>
    <div className="poker-console">
      {desktop && ownSeat}
    <div className="poker-action-dock" aria-label="การเล่นและเดิมพัน">
      {desktop && <div className="poker-console-status">{turnBanner || <span>{stages[s.phase]}</span>}</div>}
      {canShowCards && <button className="show-cards-button" disabled={!active} onClick={() => pokerSession.send('showCards')}>Show cards / เปิดไพ่</button>}
      {canAct && me ? <section className="poker-actions">
        <div className="quick-actions"><button className="fold-button" onClick={() => pokerSession.send('fold')}>Fold / หมอบ</button>{call === 0 ? <button onClick={() => pokerSession.send('check')}>Check / ผ่าน</button> : <button className="primary" onClick={() => pokerSession.send('call')}>Call {Math.min(call, me.points)}</button>}<button disabled={max > s.currentBet && !raiseAllowed} onClick={() => pokerSession.send('allIn')}>All-in {me.points}</button></div>
        {raiseAllowed && max > s.currentBet && <div className="raise-panel">
          <p className="raise-hint">เพิ่มจากยอดโต๊ะ {s.currentBet} · ขั้นต่ำ +{s.minRaise}</p>
          <div className="raise-chips" aria-label="เลือกชิป Raise">{[10,20,50,100,200].map(chip => {
            const target = s.currentBet + chip, valid = target <= max && (chip >= s.minRaise || target === max);
            return <button key={chip} type="button" className={'chip-choice chip-' + chip + (raiseTo === target ? ' selected' : '')} aria-label={'Raise เพิ่ม ' + chip} aria-pressed={raiseTo === target} title={!valid ? target > max ? 'ชิปไม่พอ' : 'Raise ขั้นต่ำเพิ่ม ' + s.minRaise : 'Raise รวมเป็น ' + target} disabled={!valid} onClick={() => setRaiseTo(target)}>{chip}</button>;
          })}<button type="button" className={'chip-all-in ' + (raiseTo === max ? 'selected' : '')} aria-label="เลือก All-in" aria-pressed={raiseTo === max} onClick={() => setRaiseTo(max)}>All-in</button></div>
          <div className="raise-controls"><label>Raise รวมเป็น<input inputMode="numeric" type="number" min={Math.min(min, max)} max={max} step="1" autoComplete="off" value={raiseValue} onChange={handleRaiseChange}/></label><button className="primary" disabled={!Number.isSafeInteger(raiseTo) || raiseTo > max || raiseTo <= s.currentBet || (raiseTo < min && raiseTo !== max)} onClick={() => pokerSession.send(raiseTo === max ? 'allIn' : 'raise', raiseTo)}>{raiseTo === max ? 'ยืนยัน All-in' : 'ยืนยัน Raise'}</button><small>ขั้นต่ำรวม {min} · สูงสุด {max}</small></div>
          <p className="raise-summary">Call {call} + Raise {Math.max(0, raiseTo - s.currentBet)} · จ่ายเพิ่ม {Math.max(0, raiseTo - me.streetBet)} ชิป · รวมเดิมพันตานี้ {raiseTo}</p>
        </div>}
      </section> : <div className="poker-dock-idle">
        {s.phase === 'LOBBY' && me ? <>{host ? <><button className="primary" disabled={!canStart} onClick={() => pokerSession.send('startRound')}>เริ่มรอบ Poker</button><button disabled={!active || s.players.length >= 6} onClick={() => pokerSession.send('addBot')}>เพิ่มบอท</button></> : <button className="primary" disabled={!active || me.points === 0} onClick={() => pokerSession.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}<span>พร้อมแล้ว {s.players.filter(p => p.ready || p.id === s.hostId).length}/{s.players.length} คน</span></> : s.phase === 'ROUND_END' ? <>{host && <button className="primary" disabled={!active} onClick={() => pokerSession.send('prepareRound')}><PokerIcon name="cards"/>เตรียมรอบใหม่</button>}<button onClick={() => setPanel('results')}><PokerIcon name="chart"/>ดูผลและสรุป Pot</button></> : <p>{s.phase === 'DEALING' ? 'กำลังแจกไพ่…' : me?.folded ? 'คุณหมอบแล้ว · รอผลรอบนี้' : me?.allIn ? 'คุณ All-in แล้ว · รอเปิดไพ่' : 'รอผู้เล่นคนอื่น · ปุ่มเดิมพันจะแสดงเมื่อถึงตาคุณ'}</p>}
      </div>}
    </div>
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
