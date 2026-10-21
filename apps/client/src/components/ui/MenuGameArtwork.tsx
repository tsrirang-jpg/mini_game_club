import type {GameKind} from '../../games';

const artwork: Record<GameKind, readonly [file: string, width: number, height: number]> = {
  roadfighter: ['roadfighter.webp', 444, 444], pok: ['pok.webp', 443, 444],
  poker: ['poker-navy-v2.webp', 1254, 1254], spyfall: ['spyfall.webp', 443, 444],
  oldmaid: ['oldmaid.webp', 444, 443], whoami: ['whoami.webp', 443, 443],
  liar: ['liar-purple-gold-v3.webp', 1254, 1254], undercover: ['undercover-charcoal-v2.webp', 1254, 1254],
};

// Menu and room entry share each versioned asset; native game cards stay separate.
export function MenuGameArtwork({game, eager = false}: {game: GameKind; eager?: boolean}) {
  const [file, width, height] = artwork[game];
  return <img className="menu-game-artwork"
    src={'/images/menu/pixel-scene-v1/' + file}
    width={width} height={height} alt="" aria-hidden="true"
    loading={eager || game === 'roadfighter' ? 'eager' : 'lazy'} decoding="async"/>;
}
