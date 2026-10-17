import { memo } from 'react';
import { WhoAmIArtwork } from './WhoAmIArtwork';
import { Card } from './components/ui/Card';
import { entryImages } from './assets/images';
import type { GameKind } from './games';
export type { GameKind } from './games';
export function SpyArtwork() {
  return <svg className="spy-artwork" viewBox="0 0 180 160" aria-hidden="true"><circle cx="90" cy="82" r="67" fill="currentColor" opacity=".12"/><path d="m35 131 27-31 28 16 29-16 29 31 9 22H24z" fill="#0a2035"/><path d="m64 52 52-2 8 44-16 23H81L60 92z" fill="#102c46"/><path d="m66 24 28-12 32 13-3 30-61 4z" fill="#0c2034"/><path d="m29 57 115-10 13 17-128 8z" fill="#071d31"/><path d="m71 77 18 4-4 10-13-4zm27 4 18-6-1 12-13 5z" fill="#7bc7f2"/><path d="M52 99 83 117 70 143 45 114zm76-2-31 20 13 27 27-30z" fill="#173b5b"/></svg>;
}
export const GameArtwork = memo(function GameArtwork({game}: {game: GameKind}) {
  if(game==='liar')return <div className="game-artwork artwork-liar" aria-hidden="true"><img src={entryImages.liar.src} width={1000} height={667} loading="lazy" alt=""/></div>;
  return <div className={'game-artwork artwork-' + game} aria-hidden="true"><span className="art-leaf leaf-left">❦</span><span className="art-leaf leaf-right">❦</span>{game === 'whoami' ? <WhoAmIArtwork/> : game === 'spyfall' ? <SpyArtwork/> : <div className="art-cards">{game === 'oldmaid' ? <><div className="art-hidden card back"><b>♠</b></div><Card card={{rank:12,suit:'spades'}}/><Card card={{rank:7,suit:'hearts'}}/></> : <><Card card={{rank:game === 'pok' ? 9 : 1,suit:'spades'}}/><Card card={{rank:13,suit:'hearts'}}/></>}</div>}</div>;
});
