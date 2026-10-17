import { memo } from 'react';
import type { Card as CardData } from '../../../../../packages/shared/src/index';
import { CourtArt } from '../../CourtArt';
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const ranks: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const Card = memo(function Card({ card, index = 0 }: { card?: CardData; index?: number }) {
  const rank = card ? (ranks[card.rank] ?? String(card.rank)) : '';
  return <div className={`card ${card ? (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : '') : 'back'}`} style={{ animationDelay: `${index * 90}ms` }} aria-label={card ? `${rank} ${card.suit}` : 'ไพ่คว่ำ'}>
    {card ? <><span>{rank}<small>{suits[card.suit]}</small></span><b>{suits[card.suit]}</b>{card.rank >= 11 && <CourtArt rank={card.rank}/>}<span className="bottom">{rank}<small>{suits[card.suit]}</small></span></> : <b>♠</b>}
  </div>;
}, (a, b) => a.card?.rank === b.card?.rank && a.card?.suit === b.card?.suit && (a.index ?? 0) === (b.index ?? 0));
