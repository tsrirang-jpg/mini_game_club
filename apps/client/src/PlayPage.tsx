import { useEffect, useState } from 'react';
import { session } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { Card, Rules, phaseLabel } from './components';
import { evaluate } from '../../../packages/shared/src/index';
export function PlayPage({ state, code }: { state: SessionState; code: string }) {
  const [now, setNow] = useState(Date.now()); const [copied, setCopied] = useState(false);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(tick); }, []);
  const s = state.snapshot;
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' || state.status === 'connecting' ? 'กำลังกลับเข้าโต๊ะ…' : 'ยังไม่ได้เข้าห้องนี้'}</h1><p>ห้อง {code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/rooms/join?code=' + code)}>เข้าห้องนี้</button>}<button className="ghost" onClick={() => navigate('/rooms/create')}>ไปหน้าสร้างห้อง</button></main>;
  const me = s.players.find(p => p.id === state.playerId);
  const idle = s.phase === 'LOBBY' || s.phase === 'ROUND_END';
  const host = s.hostId === state.playerId; const dealer = s.dealerId === state.playerId;
  const active = state.status === 'connected';
  const canAct = active && me && !me.acted && now < s.deadline && ((s.phase === 'PLAYER_ACTIONS' && !dealer) || (s.phase === 'DEALER_ACTION' && dealer));
  const seconds = s.deadline ? Math.max(0, Math.ceil((s.deadline - now) / 1000)) : 0;
  return (<main className="game">
      <div className="room-bar"><div><span className="eyebrow">โต๊ะป๊อกเด้ง</span><strong>{s.code}</strong><button className="small" onClick={async () => { try { await navigator.clipboard.writeText(s.code); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }}>{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}</button></div><div className="pok-navigation"><button className="ghost" onClick={() => session.leave('/games')}>← กลับหน้าแรก</button><button className="ghost" onClick={() => session.leave()}>ออกจากห้อง</button></div></div>
      <div className="game-layout"><section className="table-area">
        <div className="phase"><span>{phaseLabel[s.phase]}</span><span>รอบ {s.roundId || '–'}{s.deadline > 0 && ` · ${seconds} วินาที`}</span></div>
        <div className="table"><div className="table-mark">♠<span>วงไพ่</span><small>POK DENG</small></div>
          <div className="seats">{[...s.players].sort((a, b) => Number(a.id === state.playerId) - Number(b.id === state.playerId) || a.seat - b.seat).map(p => {
            const result = s.results.find(r => r.id === p.id);
            const own = p.id === state.playerId;
            const cards = result?.cards ?? (own && state.handRound === s.roundId ? state.hand : []);
            const ownValue = own && !result && cards.length >= 2 ? evaluate(cards, s.rules) : null;
            return <article key={p.id} className={`seat ${own ? 'own' : ''} ${!p.connected ? 'disconnected' : ''}`}>
              <div className="player-name">{p.name} {p.isBot && <span className="bot-badge">บอท</span>} {own && <small>คุณ</small>}{p.id === s.dealerId && <span className="dealer">เจ้ามือ</span>}</div>
              <div className="hand">{Array.from({ length: p.cardCount }, (_, i) => <Card key={`${s.roundId}-${i}`} card={cards[i]} index={i}/>)}</div>
              <div className="points">{p.points.toLocaleString()} <small>แต้ม</small></div>
              {ownValue && <div className="pok-own-value">{ownValue.handName} · {ownValue.score} แต้ม · ×{ownValue.multiplier}</div>}
              <div className="player-status">{!p.connected ? 'กำลังเชื่อมต่อใหม่' : idle ? p.ready || p.id === s.hostId ? '● พร้อม' : 'รอพร้อม' : p.acted ? 'ตัดสินใจแล้ว' : 'รอตัดสินใจ'}{p.id !== s.dealerId && ` · วาง ${p.bet}`}</div>
              {result && <div className={`result ${result.delta > 0 ? 'win' : result.delta < 0 ? 'lose' : ''}`}>{result.handName} · {result.score} แต้ม · {result.multiplier} เด้ง<br/>{result.outcome === 'TIE' ? 'เสมอ' : result.outcome === 'DEALER' ? 'รวมเจ้ามือ' : result.outcome === 'WIN' ? 'ชนะ' : 'แพ้'} {result.delta > 0 ? '+' : ''}{result.delta}{!s.settled && ' (รอสรุป)'}</div>}
            </article>;
          })}</div>
        </div>
        <div className="action-bar">{canAct ? <><button className="ghost" onClick={() => session.send('stand')}>อยู่</button><button className="primary" onClick={() => session.send('draw')}>จั่วอีกใบ</button></> : <p>{idle ? 'เตรียมตัวให้พร้อม แล้วชวนเพื่อนเข้าห้อง' : me?.acted ? 'คุณตัดสินใจแล้ว รอเปิดไพ่พร้อมกัน' : 'รอจังหวะเล่นของคุณ'}</p>}</div>
      </section><aside className="controls"><h2>โต๊ะของเรา <small>{s.players.length}/6 คน</small></h2>
        {host && s.phase === 'LOBBY' && <section className="bot-controls"><h3>เล่นกับบอท</h3><button className="ghost full" disabled={!active || s.players.length >= s.rules.maxPlayers} onClick={() => session.send('addBot')}>เพิ่มบอท</button>{s.players.filter(p => p.isBot).map(bot => <div className="bot-row" key={bot.id}><span>{bot.name}</span><button className="small" disabled={!active} aria-label={'นำ ' + bot.name + ' ออก'} onClick={() => session.send('removeBot', bot.id)}>นำออก</button></div>)}<p className="fine">บอทพร้อมเล่นอัตโนมัติ และเลือกเป็นเจ้ามือได้</p></section>}
        {me && <><p className="muted">{dealer ? 'คุณเป็นเจ้ามือรอบนี้' : 'เลือกแต้มที่ต้องการวาง'}</p>{!dealer && <div className="bets">{s.rules.bets.map(bet => <button key={bet} className={me.bet === bet ? 'selected' : ''} disabled={!idle || !active} onClick={() => session.send('setBet', bet)}>{bet}</button>)}</div>}
          {host && idle && <label>เจ้ามือ<select disabled={!active} value={s.dealerId} onChange={e => session.send('selectDealer', e.target.value)}>{s.players.filter(p => p.connected).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
          {idle && !host && <button className="primary full" disabled={!active} onClick={() => session.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}
          {host && s.phase === 'LOBBY' && <><button className="primary full" disabled={!active || s.players.length < 2 || s.players.some(p => !p.connected || (p.id !== s.hostId && !p.ready))} onClick={() => session.send('startRound')}>เริ่มรอบ</button><button className="ghost full" disabled={!active} onClick={() => session.send('resetTablePoints')}>รีเซ็ตทั้งโต๊ะเป็น 1,000 แต้ม</button></>}
          {host && s.phase === 'ROUND_END' && <button className="primary full" disabled={!active} onClick={() => session.send('prepareRound')}>เตรียมรอบใหม่</button>}
        </>}<div className="connection"><i className={active ? 'online' : ''}/>{active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}</div><Rules/><p className="fine">แต้มจำลอง ไม่มีมูลค่าเงินจริง<br/>ห้องและแต้มจะหายเมื่อ server restart</p>
      </aside></div>
    </main>);
}
