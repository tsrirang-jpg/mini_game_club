import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { Card as CardData } from '../../../../../packages/shared/src/index';
import { Card } from '../ui/Card';

// Key this component by roundId. Keep the same animation after DEALING ends,
// so a phase/private-hand update cannot restart it. A restored/resized hand
// mounted after dealing renders immediately without replaying the deal.
export function PokerHoleCards({ cards, inHand, dealing, seat }: {
  cards: CardData[]; inHand: boolean; dealing: boolean; seat: number;
}) {
  const [animateDeal] = useState(dealing);
  return <div className={'hand' + (animateDeal ? ' deal-once' : '')}
    style={{ '--deal-seat': seat } as CSSProperties}>
    {[0, 1].map(i => inHand
      ? <Card key={i} card={cards[i]}/>
      : <span key={i} className="poker-hole-placeholder" aria-hidden="true"/>)}
  </div>;
}
