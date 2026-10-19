export function PokerTurnTimer({ label, seconds, progress }: {
  label: string; seconds: number; progress: number;
}) {
  return <div className="turn-banner" role="status">
    <span>{label} · {seconds} วินาที</span>
    <div className="turn-time"><i style={{ width: Math.max(0, Math.min(100, progress)) + '%' }}/></div>
  </div>;
}
