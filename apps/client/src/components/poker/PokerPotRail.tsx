import type { PokerPotSummary } from '../../../../../packages/shared/src/poker';

export const pokerPotLabel = (pots: readonly { refund: boolean }[], index: number) => {
  if (pots[index].refund) return 'คืนชิป';
  const earlier = pots.slice(0, index).filter(pot => !pot.refund).length;
  return earlier === 0 ? 'Main Pot' : 'Side Pot ' + earlier;
};

// Keep the rail mounted even before the first bet. Pot count never changes
// the table tracks; full eligibility and awards stay in the details dialog.
export function PokerPotRail({ pots, playerName, onDetails }: {
  pots: readonly PokerPotSummary[];
  playerName: (id: string) => string;
  onDetails: () => void;
}) {
  const entries: readonly PokerPotSummary[] = pots.length ? pots
    : [{ amount: 0, refund: false, eligible: [], winners: [], awards: {} }];
  return <section className="pot-breakdown pot-rail" aria-label="กองเดิมพันแยก">
    <span className="pot-rail-label">กองเดิมพัน</span>
    <div className="pot-grid">{entries.map((pot, index) => {
      const label = pokerPotLabel(entries, index);
      const owners = pot.refund ? pot.winners.map(playerName).join(', ') : '';
      return <button type="button" key={index}
        className={'pot-entry ' + (pot.refund ? 'pot-refund' : label === 'Main Pot' ? 'pot-main' : 'pot-side')}
        aria-label={label + ' ' + pot.amount + ' ชิป'}
        title={pot.refund ? 'คืนชิป: ' + owners : pot.winners.length
          ? 'รับ: ' + pot.winners.map(id => playerName(id) + ' ' + pot.awards[id]).join(', ')
          : 'มีสิทธิ์: ' + pot.eligible.map(playerName).join(', ')}
        onClick={onDetails}>
        <span className="pot-title">{label}</span>
        <span className="pot-value"><strong>{pot.amount.toLocaleString()}</strong>
          {owners && <small className="pot-refund-owner">· {owners}</small>}</span>
      </button>;
    })}</div>
    <button type="button" className="pot-rail-details" aria-label="ดูรายละเอียดกองเดิมพัน" onClick={onDetails}><span aria-hidden="true">›</span></button>
  </section>;
}
