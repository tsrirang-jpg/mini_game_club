import type {GameKind} from '../../games';

const dimensions: Record<GameKind, readonly [number, number]> = {
  roadfighter: [444, 444], pok: [443, 444], poker: [444, 444], spyfall: [443, 444],
  oldmaid: [444, 443], whoami: [443, 443], liar: [444, 443], undercover: [443, 443],
};

// Catalogue art is separate from the native cards used in the actual games.
export function MenuGameArtwork({game}: {game: GameKind}) {
  const [width, height] = dimensions[game];
  return <img className="menu-game-artwork"
    src={`/images/menu/pixel-scene-v1/${game}.webp`}
    width={width} height={height} alt="" aria-hidden="true"
    loading={game === 'roadfighter' ? 'eager' : 'lazy'} decoding="async"/>;
}
