import './brand-logo.css';
import { brandImage } from '../../assets/images';

// Use the approved 04 artwork itself; do not redraw it per game or breakpoint.
function BrandMark() {
  return <img className="brand-mark" src={brandImage.src} alt="" width={brandImage.width} height={brandImage.height} decoding="async"/>;
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-logo${compact ? ' brand-logo-compact' : ''}`}>
    <BrandMark/>
    <span className="brand-copy"><b className="brand-name">วงเซียน</b><small className="brand-descriptor">MINI GAME CLUB</small></span>
  </span>;
}
