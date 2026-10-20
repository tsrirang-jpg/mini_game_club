const point=(angle:number,r:number)=>{const a=angle*Math.PI/180;return {x:120+Math.cos(a)*r,y:126+Math.sin(a)*r};};
function arc(from:number,to:number,r:number){const a=point(from,r),b=point(to,r);return 'M '+a.x+' '+a.y+' A '+r+' '+r+' 0 '+(to-from>180?1:0)+' 1 '+b.x+' '+b.y;}
export function Gauge({kind,value,max=240}:{kind:'speed'|'fuel';value:number;max?:number}){
  const speed=kind==='speed',start=speed?150:180,end=speed?390:360,ratio=Math.max(0,Math.min(1,value/(speed?max:100))),angle=start+(end-start)*ratio;
  const needle=point(angle,speed?83:76),ticks=speed?24:10;
  return <div className={'road-gauge road-gauge-'+kind} role="meter" aria-label={speed?'ความเร็ว':'น้ำมัน'} aria-valuemin={0} aria-valuemax={speed?max:100} aria-valuenow={Math.round(value)} aria-valuetext={Math.round(value)+(speed?' กิโลเมตรต่อชั่วโมง':' เปอร์เซ็นต์')}>
    <svg preserveAspectRatio="xMidYMin meet" viewBox={speed?'0 10 240 186':'0 12 240 164'} aria-hidden="true">
      <path d={arc(start,end,103)} fill="none" stroke="#e9e9e6" strokeWidth="2"/>
      <path d={arc(speed?end-37:start,speed?end:start+30,99)} fill="none" stroke="#fa263a" strokeWidth="8"/>
      {Array.from({length:ticks+1},(_,i)=>{const a=start+(end-start)*i/ticks,p=point(a,100),q=point(a,i%(speed?4:5)===0?87:94);return <path key={i} d={'M '+p.x+' '+p.y+' '+q.x+' '+q.y} stroke="#ededeb" strokeWidth={i%4===0?2:1}/>;})}
      {speed?Array.from({length:7},(_,i)=>{const p=point(start+(end-start)*i/6,73);return <text key={i} x={p.x} y={p.y+4} textAnchor="middle" fill="#fafafa" fontSize="12" fontWeight="700">{Math.round(max*i/6)}</text>;}):<><text x="24" y="145" fill="white" fontSize="16">E</text><text x="204" y="145" fill="white" fontSize="16">F</text></>}
      <path d={'M 120 126 L '+needle.x+' '+needle.y} stroke="#ff293b" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="120" cy="126" r="7" fill="#fff" stroke="#262626" strokeWidth="2"/>
      <text x="120" y={speed?166:158} textAnchor="middle" fill="#fff" fontSize={speed?27:23} fontWeight="800">{Math.round(value)}{!speed&&'%'}</text>
      {speed&&<text x="120" y="184" textAnchor="middle" fill="#d8d8d8" fontSize="13">km/h</text>}
    </svg>
  </div>;
}
