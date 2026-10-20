import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {GameSelectCard} from './components/ui/GameSelectCard';
import {gameOptions} from './games';
import {navigate,getRoute,subscribeRoute} from './router';
import {ArcadeHeader} from './roadfighter/ArcadeHeader';
import {RoadIcon} from './roadfighter/RoadIcon';
import {loadPreferences,savePreferences} from './roadfighter/storage';
import type {IconName} from './roadfighter/RoadIcon';
import './roadfighter/roadfighter.css';
import './game-selection.css';
const filters=[{id:'all',label:'ทั้งหมด',icon:'grid'},{id:'arcade',label:'อาร์เคด',icon:'car'},{id:'cards',label:'เกมไพ่',icon:'cards'},{id:'party',label:'ปาร์ตี้',icon:'party'}] as const;
function MenuSettings({sound,toggle,close}:{sound:boolean;toggle:()=>void;close:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);return <dialog className="road-dialog" ref={ref} onCancel={close} aria-labelledby="menu-settings-title"><button className="road-dialog-close" onClick={close} aria-label="ปิดการตั้งค่า">×</button><h2 id="menu-settings-title">การตั้งค่า</h2><p>เสียงเกมอาร์เคด</p><button role="switch" aria-label="เสียงเกมอาร์เคด" aria-checked={sound} onClick={toggle}><RoadIcon name={sound?'sound':'muted'}/>{sound?'เปิด':'ปิด'}</button><p>การตั้งค่านี้จะถูกจำไว้บนอุปกรณ์ของคุณ</p><button className="road-primary" onClick={close}>เรียบร้อย</button></dialog>;}
export function GameSelectPage(){
  const route=useSyncExternalStore(subscribeRoute,getRoute),raw=new URLSearchParams(route.split('?')[1]).get('category');
  const category=filters.find(f=>f.id===raw)?.id??'all';
  const [prefs,setPrefs]=useState(loadPreferences),[settings,setSettings]=useState(false);
  const toggleSound=()=>setPrefs(p=>{const next={...p,sound:!p.sound};savePreferences(next);return next;});
  const select=(id:string)=>navigate('/games'+(id==='all'?'':'?category='+id));
  const options=gameOptions.filter(g=>category==='all'||g.category===category);
  return <div className="arcade-shell arcade-selection-shell"><ArcadeHeader mode="menu" name={prefs.name} sound={prefs.sound} onSound={toggleSound} onSettings={()=>setSettings(true)}/>
    <main className="game-select"><div className="menu-intro"><h1>เลือกเกมของคุณ</h1><p>เลือกเกม แล้วมาเล่นด้วยกัน</p></div>
      <div className="menu-filters" role="tablist" aria-label="ประเภทเกม">{filters.map((filter,index)=><button key={filter.id} id={'category-'+filter.id} type="button" role="tab" aria-selected={category===filter.id} aria-controls="game-category-panel" tabIndex={category===filter.id?0:-1} onClick={()=>select(filter.id)} onKeyDown={e=>{let next=index;if(e.key==='ArrowRight')next=(index+1)%filters.length;else if(e.key==='ArrowLeft')next=(index+filters.length-1)%filters.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=filters.length-1;else return;e.preventDefault();select(filters[next].id);document.getElementById('category-'+filters[next].id)?.focus();}}><RoadIcon name={filter.icon as IconName}/>{filter.label}</button>)}</div>
      <section id="game-category-panel" role="tabpanel" aria-labelledby={'category-'+category} className="game-options">{options.map(g=><GameSelectCard key={g.game} game={g.game}/>)}</section>
    </main><footer className="menu-footer">เล่นเพื่อความสนุก · แต้มจำลอง ไม่มีมูลค่าเงินจริง</footer>
    {settings&&<MenuSettings sound={prefs.sound} toggle={toggleSound} close={()=>setSettings(false)}/>}
  </div>;
}
