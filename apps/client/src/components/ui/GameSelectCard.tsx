import {games} from '../../games';
import type {GameKind} from '../../games';
import {navigate} from '../../router';
import {RoadIcon} from '../../roadfighter/RoadIcon';
import {MenuGameArtwork} from './MenuGameArtwork';

const categories = {arcade: 'อาร์เคด', cards: 'เกมไพ่', party: 'ปาร์ตี้'} as const;
const categoryIcons = {arcade: 'car', cards: 'cards', party: 'party'} as const;

export function GameSelectCard({game}: {game: GameKind}) {
  const option = games[game];
  return <button type="button" className={'game-option theme-' + game} data-game={game}
    aria-label={option.action} aria-describedby={`menu-description-${game}`}
    onClick={() => navigate(option.path)}>
    <div className="menu-card-art"><MenuGameArtwork game={game}/></div>
    <div className="menu-card-copy">
      <span className="menu-genre">
        <RoadIcon name={categoryIcons[option.category]}/>{categories[option.category]}
      </span>
      <h2 lang={/[\u0E00-\u0E7F]/.test(option.name) ? 'th' : 'en'}>{option.name}</h2>
      <p id={`menu-description-${game}`}>{option.copy}</p>
      <span className="player-count-pill"><RoadIcon name="user"/>{option.players}</span>
      <span className="menu-start-cta">เริ่มเล่น <RoadIcon name="right"/></span>
    </div>
  </button>;
}
