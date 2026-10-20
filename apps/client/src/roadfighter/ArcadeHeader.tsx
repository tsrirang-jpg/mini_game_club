import {BrandLogo} from '../components/ui/BrandLogo';
import {navigate} from '../router';
import {RoadIcon} from './RoadIcon';
export function ArcadeHeader({mode='play',name='Player',sound=true,onSound,onHelp,onPause,onSettings,paused=false}:{mode?:'menu'|'start'|'play';name?:string;sound?:boolean;onSound?:()=>void;onHelp?:()=>void;onPause?:()=>void;onSettings?:()=>void;paused?:boolean}){
  return <header className={'arcade-header top arcade-header-'+mode}>
    {mode==='start'&&<button className="arcade-back" aria-label="เลือกเกมอื่น" onClick={()=>navigate('/games')}><RoadIcon name="back"/><span>เลือกเกมอื่น</span></button>}
    <a className="brand" href="/games" aria-label="วงเซียน · Mini Game Club" onClick={e=>{e.preventDefault();navigate('/games');}}><BrandLogo/></a>
    <nav aria-label="เมนูเกม">
      {mode==='menu'&&<span className="tag arcade-profile"><RoadIcon name="user"/><span className="arcade-profile-name">{name}</span></span>}
      {onHelp&&<button className="road-header-help" aria-label="วิธีเล่น" onClick={onHelp}><RoadIcon name="help"/><span className="road-header-label">วิธีเล่น</span></button>}
      {onSound&&<button aria-label={sound?'ปิดเสียง':'เปิดเสียง'} aria-pressed={sound} onClick={onSound}><RoadIcon name={sound?'sound':'muted'}/></button>}
      {onSettings&&<button className="menu-settings-button" aria-label="ตั้งค่า" onClick={onSettings}><RoadIcon name="settings"/></button>}
      {onPause&&<button aria-label={paused?'เล่นต่อ':'พักเกม'} onClick={onPause}><RoadIcon name={paused?'play':'pause'}/></button>}
      {mode==='play'&&<button className="arcade-back" aria-label="เลือกเกมอื่น" onClick={()=>navigate('/games')}><RoadIcon name="back"/><span className="road-header-label">เลือกเกมอื่น</span></button>}
    </nav>
  </header>;
}
