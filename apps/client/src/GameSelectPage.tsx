import { navigate } from './router';
import { GameArtwork } from './GameArtwork';
import { gameOptions } from './games';
export function GameSelectPage() {
  return <main className="game-select"><span className="eyebrow">วงเซียน · เล่นด้วยกัน สนุกทั้งวง</span><h1>วันนี้เข้าวงไหน?</h1><p className="muted">เลือกเกม สร้างห้อง แล้วชวนเพื่อนมาเข้าวง</p><div className="game-options">{gameOptions.map(g => <button key={g.game} className={`game-option theme-${g.game}`} aria-label={g.action} onClick={() => navigate(g.path)}><GameArtwork game={g.game}/><span className="eyebrow">{g.caption}</span><h2>{g.name}</h2><p>{g.copy}</p><div className="game-option-bottom"><span className="player-count-pill">{g.players}</span><strong>{g.action}</strong></div></button>)}</div></main>;
}
