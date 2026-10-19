import { useId } from 'react';

export function PokIcon({name}: {name:'draw'|'stand'|'clock'|'rules'|'table'|'leave'}) {
  const paths = {
    draw:<><rect x="8" y="5" width="12" height="16" rx="2"/><path d="M5 17 2 5l11-3 1 3m1 6v6m-3-3h6"/></>,
    stand:<><path d="M8 12V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9c0 4-3 7-7 7h-1c-3 0-4-1-6-4l-4-5c-1-2 1-4 3-2l3 3"/></>,
    clock:<><circle cx="12" cy="14" r="8"/><path d="M12 10v5l3 2M9 2h6m-3 0v4m7 1 2-2"/></>,
    rules:<><path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6Z"/><path d="M12 7v6m0 3v1"/></>,
    table:<><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    leave:<><path d="M10 3H3v18h7m-1-9h13m-5-5 5 5-5 5"/></>,
  };
  return <svg className="pok-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
export function PokLanterns() {
  const id=useId();
  return <div className="arena-lanterns" aria-hidden="true">{[0,1,2,3].map(i=><svg key={i} className={'arena-lantern lantern-'+i} viewBox="0 0 50 160"><defs><radialGradient id={id+i}><stop stopColor="#ffe7a0"/><stop offset="1" stopColor="#bd8626"/></radialGradient></defs><path d="M25 0v43m-18 9 18-10 18 10-4 50-14 10-14-10Z" fill={'url(#'+id+i+')'} stroke="#e7bf66"/><path d="M17 52v49m8-52v58m8-55v49M12 110h26m-13 0v32m-7-7 7 10 7-10" stroke="#e9c477" fill="none"/><path d="m25 17-15 9 15 8 15-8Z" stroke="#9f7e39" fill="none"/></svg>)}</div>;
}
export function PokMedallion() {
  return <div className="arena-medallion" aria-hidden="true"><span className="medallion-suit">♠</span><div><span className="arena-flourish">❧</span><strong>ป๊อกเด้ง</strong><span className="arena-flourish">❧</span></div><span className="medallion-line"/></div>;
}
