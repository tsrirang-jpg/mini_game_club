import type { PokerPlayer, PokerSnapshot } from '../../../../../packages/shared/src/poker';
import type { SessionState } from '../../session';
import { PokerHoleCards } from './PokerHoleCards';
import { PokerAvatar, PokerIcon } from './PokerArtwork';

export function PokerSeat({ player: p, snapshot: s, state, now, turnLabel }: {
  player: PokerPlayer; snapshot: PokerSnapshot; state: SessionState<PokerSnapshot>; now: number; turnLabel?: string;
}) {
  const own = p.id === state.playerId;
  const result = s.results.find(r => r.id === p.id);
  // Private cards only belong to this player and this round. Showdown uses server results.
  const cards = result?.cards.length ? result.cards : own && state.handRound === s.roundId ? state.hand : [];
  const winner = !!result && s.pots.some(pot => !pot.refund && pot.winners.includes(p.id));
  const status = turnLabel && p.connected ? turnLabel : !p.connected ? p.reconnectUntil > now ? 'Reconnect ' + Math.ceil((p.reconnectUntil - now) / 1000) + 's' : 'ออกจากห้องแล้ว'
    : p.points === 0 && !p.inHand ? 'ไม่มีชิป / พัก'
    : s.phase === 'LOBBY' ? p.ready || p.id === s.hostId ? '● พร้อม' : 'รอพร้อม'
    : p.lastAction || 'รอเล่น';
  return <article aria-label={'ผู้เล่น ' + p.name} data-seat={p.seat % 6}
    className={'poker-seat ' + (own ? 'own ' : '') + (s.turnId === p.id ? 'on-turn ' : '') + (winner ? 'winner ' : '') + (p.points === 0 ? 'chips-empty ' : '') + (p.folded ? 'folded' : '')}>
    {winner && <span className="seat-winner"><PokerIcon name="crown"/><span>WINNER</span></span>}
    <div className="poker-avatar"><PokerAvatar seat={p.seat}/></div>
    <div className="player-name" title={p.name}><span className="seat-number">#{p.seat + 1}</span><span className="poker-player-label">{p.name}</span>{own && <small>คุณ</small>}{p.isBot && <span className="bot-badge">บอท</span>}</div>
    <div className="poker-badges">{s.buttonId === p.id && <span className="button-chip">D</span>}{s.smallBlindId === p.id && <span>SB</span>}{s.bigBlindId === p.id && <span>BB</span>}{p.allIn && <span className="all-in-tag">ALL-IN</span>}</div>
    <PokerHoleCards key={s.roundId} cards={cards} inHand={p.inHand} dealing={s.phase === 'DEALING'} seat={p.seat}/>
    <div className="points">{p.points.toLocaleString()} <small>ชิป</small></div>
    {!result && <div className="player-status" title={status + (p.streetBet > 0 ? ' · วาง ' + p.streetBet : '')}>{status}{p.streetBet > 0 && ' · วาง ' + p.streetBet}</div>}
    {result && <div title={result.handName + ' · ' + result.delta + ' ชิป · รับ ' + result.payout} className={'result ' + (result.delta > 0 ? 'win' : result.delta < 0 ? 'lose' : '')}><span>{result.handName}</span><b>{result.delta > 0 ? '+' : ''}{result.delta}</b></div>}
  </article>;
}
