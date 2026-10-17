import { entryImages } from './assets/images';
export function WhoAmIArtwork({eager=false}:{eager?:boolean}) {
  const image=entryImages.whoami;
  return <img className="who-artwork" src={image.src} width={image.width} height={image.height} decoding="async" loading={eager?'eager':'lazy'} alt=""/>;
}
