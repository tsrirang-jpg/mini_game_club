import { useId } from 'react';

/** Small inline artwork keeps the table sharp at every size without image requests. */
export function PokerAvatar({ seat }: { seat: number }) {
  const id = useId();
  const palettes = [
    ['#123766', '#3bd9ff', '#171c35', '#efbca0', '#3a70b2'],
    ['#372059', '#ad82ff', '#342334', '#f4c2ad', '#9764d4'],
    ['#124d4a', '#5be9bd', '#23293c', '#d6a384', '#2b9b94'],
    ['#40285a', '#d998ff', '#192336', '#f0bda1', '#6471bd'],
    ['#293b62', '#8bafff', '#49342f', '#f4c8ad', '#b16c7c'],
    ['#173d50', '#69dbff', '#302c43', '#d8a991', '#3b789c'],
  ];
  const [bg, accent, hair, skin, shirt] = palettes[seat % palettes.length];
  return <svg viewBox="0 0 80 80" aria-hidden="true" focusable="false">
    <defs><clipPath id={id}><circle cx="40" cy="40" r="37"/></clipPath></defs>
    <circle cx="40" cy="40" r="39" fill={bg} stroke={accent} strokeWidth="2"/>
    <g clipPath={'url(#' + id + ')'}>
      <path d="M0 61 63 0h22L12 80H0Z" fill={accent} opacity=".12"/>
      <path d="M8 86q1-28 25-30h14q25 2 25 30" fill={shirt}/>
      <path d="m31 55 9 14 10-14-7-5Z" fill={skin}/>
      <path d="m28 58 12 11-8 9-10-17m29-3L40 69l8 9 10-17" fill="white" opacity=".18"/>
      <path d="M19 34q-2-27 22-27 25 0 21 29l-5 20H24Z" fill={hair}/>
      <ellipse cx="40" cy="35" rx="18" ry="23" fill={skin}/>
      <path d="M20 31Q16 8 42 7q27 2 20 30l-9-17-8 9 1-12-13 14 1-10-12 15Z" fill={hair}/>
      <path d="m28 34 7-1m10 0 7 1" stroke={hair} strokeWidth="2" strokeLinecap="round"/>
      <path d="M30 38h3m14 0h3" stroke="#25263c" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="m40 39-2 7h4m-7 4q5 4 10 0" fill="none" stroke="#aa715f" strokeWidth="1.5" strokeLinecap="round"/>
      {seat === 3 && <g fill="#14203a" stroke={accent} strokeWidth="1"><path d="M24 34h14l-2 9H26Zm18 0h14l-2 9H44Z"/><path d="M38 36h4"/></g>}
      {seat === 4 && <path d="M17 26q4-21 24-20 21 1 24 22H17Z" fill={shirt}/>}
    </g>
  </svg>;
}

export function ChipStack({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 86 55" aria-hidden="true" focusable="false">
    {[{x:3,y:28,c:'#7355cf'},{x:48,y:25,c:'#4f9de5'},{x:25,y:7,c:'#77d4ff'}].map(({x,y,c}) => <g key={x} transform={`translate(${x} ${y})`}>
      {[12,7,2].map(n => <g key={n}><path d={`M0 ${n}h32v5c0 8-32 8-32 0Z`} fill={c} stroke="#111b43" strokeWidth="1.5"/><ellipse cx="16" cy={n} rx="16" ry="6" fill={c} stroke="#cedcff" strokeWidth="1.5"/><path d={`M4 ${n+2}v5m12-2v5m12-8v5`} stroke="white" strokeWidth="2" opacity=".7"/></g>)}
      <ellipse cx="16" cy="2" rx="8" ry="3" fill="#172650" opacity=".6"/>
    </g>)}
  </svg>;
}

type IconName = 'rules' | 'table' | 'leave' | 'crown' | 'cards' | 'chart';
const paths: Record<IconName, string> = {
  rules: 'M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7L12 3Zm0 5v5m0 3v1',
  table: 'M4 4h6v6H4Zm10 0h6v6h-6ZM4 14h6v6H4Zm10 0h6v6h-6Z',
  leave: 'M9 4H4v16h5m5-12 4 4-4 4m-6-4h12',
  crown: 'm3 6 5 5 4-8 4 8 5-5-3 13H6L3 6Zm3 16h12',
  cards: 'm4 5 10-2 4 16-10 2L4 5Zm13 0h3v14m-9-8 2 3-2 3-2-3 2-3Z',
  chart: 'M4 13v7m5-13v13m6-17v17m5-10v10',
};
export function PokerIcon({ name }: { name: IconName }) {
  return <svg className="poker-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d={paths[name]}/></svg>;
}
