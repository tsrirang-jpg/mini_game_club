import './brand-logo.css';

// One versioned vector asset is shared by headers, room branding and the favicon.
export function BrandMark() {
  return <img className="brand-mark" src="/images/brand/wong-sian-mark-v1.svg" alt="" width="48" height="48" decoding="async"/>;
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <span className={`brand-logo${compact ? ' brand-logo-compact' : ''}`}>
    <BrandMark/>
    <span className="brand-copy"><b className="brand-name">วงเซียน</b><small className="brand-descriptor">MINI GAME CLUB</small></span>
  </span>;
}
