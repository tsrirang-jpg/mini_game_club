import {useEffect,useRef} from 'react';
import {RoadEngine} from './engine';
import {paintRoad} from './pixels';
export function RoadTrack({engine,preview=false,onUpdate,className=''}:{engine?:RoadEngine;preview?:boolean;onUpdate?:()=>void;className?:string}){
  const ref=useRef<HTMLCanvasElement>(null),notify=useRef(onUpdate);notify.current=onUpdate;
  useEffect(()=>{
    const canvas=ref.current!,ctx=canvas.getContext('2d');if(!ctx)return;
    const race=engine??new RoadEngine();let raf=0,last=0,accumulator=0,report=0;
    const resize=()=>{const r=canvas.getBoundingClientRect();race.resize(256*r.height/Math.max(1,r.width));canvas.width=256;canvas.height=race.height;paintRoad(ctx,race,preview);};
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    const frame=(now:number)=>{if(last){accumulator+=Math.min((now-last)/1000,.1);while(accumulator>=1/60){race.step(1/60);accumulator-=1/60;}}last=now;paintRoad(ctx,race);if(now-report>=100){notify.current?.();report=now;}raf=requestAnimationFrame(frame);};
    if(!preview)raf=requestAnimationFrame(frame);
    return()=>{observer.disconnect();cancelAnimationFrame(raf);};
  },[engine,preview]);
  return <canvas ref={ref} width={256} height={320} className={'road-track '+className} role="img" aria-label={preview?'ตัวอย่างสนามแข่งพิกเซล':'สนามแข่ง หลบรถและเก็บน้ำมัน ใช้ A D หรือปุ่มลูกศรเลี้ยว'}/>;
}
