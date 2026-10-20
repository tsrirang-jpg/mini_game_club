import { memo } from 'react';
import { RoadTrack } from './roadfighter/RoadTrack';
import { WhoAmIArtwork } from './WhoAmIArtwork';
import { Card } from './components/ui/Card';
import type { Card as CardData } from '../../../packages/shared/src/index';
import type { GameKind } from './games';
import { menuImages } from './assets/images';
export type { GameKind } from './games';
export function SpyArtwork() {
  return <svg className="spy-artwork" viewBox="0 0 180 160" aria-hidden="true"><circle cx="90" cy="82" r="67" fill="currentColor" opacity=".12"/><path d="m35 131 27-31 28 16 29-16 29 31 9 22H24z" fill="#0a2035"/><path d="m64 52 52-2 8 44-16 23H81L60 92z" fill="#102c46"/><path d="m66 24 28-12 32 13-3 30-61 4z" fill="#0c2034"/><path d="m29 57 115-10 13 17-128 8z" fill="#071d31"/><path d="m71 77 18 4-4 10-13-4zm27 4 18-6-1 12-13 5z" fill="#7bc7f2"/><path d="M52 99 83 117 70 143 45 114zm76-2-31 20 13 27 27-30z" fill="#173b5b"/></svg>;
}
function CardFan({cards,backs=0}:{cards:CardData[];backs?:number}) {
  return <div className="art-cards">{Array.from({length:backs},(_,i)=><Card key={`back-${i}`}/>)}{cards.map(card=><Card key={`${card.rank}-${card.suit}`} card={card}/>)}</div>;
}
export const GameArtwork = memo(function GameArtwork({game}: {game: GameKind}) {
  if (game === 'roadfighter') return <div className="game-artwork artwork-roadfighter" aria-hidden="true"><RoadTrack preview/></div>;
  if (game === 'undercover') return <div className="game-artwork artwork-undercover" aria-hidden="true"><img {...menuImages.undercover} alt="" loading="lazy" decoding="async"/></div>;
  const cards:CardData[]=game==='oldmaid'?[{rank:12,suit:'spades'},{rank:12,suit:'hearts'}]:game==='liar'?[{rank:1,suit:'clubs'}]:[{rank:game==='pok'?9:1,suit:'spades'},{rank:13,suit:'hearts'}];
  return <div className={'game-artwork artwork-' + game} aria-hidden="true"><span className="art-leaf leaf-left">❦</span><span className="art-leaf leaf-right">❦</span>{game==='whoami'?<WhoAmIArtwork/>:game==='spyfall'?<SpyArtwork/>:<CardFan cards={cards} backs={game==='oldmaid'?1:game==='liar'?2:0}/>}</div>;
});
