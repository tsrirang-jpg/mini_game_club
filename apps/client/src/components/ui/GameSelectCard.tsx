import { GameArtwork } from '../../GameArtwork';
import { games } from '../../games';
import type { GameKind } from '../../games';
import { navigate } from '../../router';
import './game-select-card.css';

// One native button makes the whole card clickable without nested controls.
export function GameSelectCard({ game }: { game: GameKind }) {
  const option = games[game];
  return <button type="button" className={`game-option theme-${game}`} aria-label={option.action} onClick={() => navigate(option.path)}>
    <GameArtwork game={game}/>
    <span className="eyebrow">{option.caption}</span>
    <h2>{option.name}</h2>
    <p>{option.copy}</p>
    <div className="game-option-bottom">
      <span className="player-count-pill">{option.players}</span>
      <span className="game-select-action">{option.action}</span>
    </div>
  </button>;
}
