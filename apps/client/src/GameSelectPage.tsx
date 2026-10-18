import { GameSelectCard } from './components/ui/GameSelectCard';
import { gameOptions } from './games';
export function GameSelectPage() {
  return <main className="game-select"><span className="eyebrow">วงเซียน · เล่นด้วยกัน สนุกทั้งวง</span><h1>วันนี้เข้าวงไหน?</h1><p className="muted">เลือกเกม สร้างห้อง แล้วชวนเพื่อนมาเข้าวง</p><div className="game-options">{gameOptions.map(g => <GameSelectCard key={g.game} game={g.game}/>)}</div></main>;
}
