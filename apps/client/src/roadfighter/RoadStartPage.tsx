import {useState} from 'react';
import {navigate} from '../router';
import {ArcadeHeader} from './ArcadeHeader';
import {RoadTrack} from './RoadTrack';
import {RoadIcon} from './RoadIcon';
import {RoadControlsGuide,RoadHelp} from './RoadHelp';
import {DIFFICULTIES} from './engine';
import type {Difficulty} from './engine';
import {loadPreferences,loadRecords,savePreferences} from './storage';
import './roadfighter.css';
export function RoadStartPage(){
  const [prefs,setPrefs]=useState(loadPreferences),[help,setHelp]=useState(false),[records]=useState(loadRecords);
  const setSound=()=>setPrefs(p=>{const next={...p,sound:!p.sound};savePreferences(next);return next;});
  return <div className="arcade-shell road-start-page"><ArcadeHeader mode="start" sound={prefs.sound} onSound={setSound} onHelp={()=>setHelp(true)}/>
    <main className="road-start-main"><div className="road-start-heading"><h1 className="road-title">ROAD FIGHTER</h1><div><span className="road-pill">อาร์เคด · 1 คน</span><p>หลบรถ เก็บน้ำมัน ไปให้ถึงเส้นชัย</p></div></div>
      <div className="road-start-grid"><section className="road-start-preview" aria-label="ตัวอย่างเกม"><RoadTrack preview/></section>
        <form className="road-setup road-panel" onSubmit={e=>{e.preventDefault();if(!prefs.name.trim())return;savePreferences({...prefs,name:prefs.name.trim()});navigate('/road-fighter/play');}}>
          <h2>พร้อมออกตัวไหม?</h2><label htmlFor="road-name">ชื่อผู้เล่น<input id="road-name" name="name" autoComplete="nickname" value={prefs.name} required maxLength={20} onChange={e=>setPrefs(p=>({...p,name:e.target.value}))}/></label>
          <fieldset><legend>ระดับความยาก</legend><div className="road-difficulty">{(Object.keys(DIFFICULTIES) as Difficulty[]).map(key=><label key={key} className={prefs.difficulty===key?'active':''}><input type="radio" name="difficulty" value={key} checked={prefs.difficulty===key} onChange={()=>setPrefs(p=>({...p,difficulty:key}))}/><span>{DIFFICULTIES[key].label}</span></label>)}</div></fieldset>
          <div className="road-stage-choice"><strong>STAGE 01<br/>GREEN VALLEY</strong><span aria-hidden="true">▟ ▚ ▟</span><small>3 ด่าน · ด่านละ 4 km</small></div>
          <label className="road-sound-setting">เสียงเกม<button type="button" className="road-toggle" role="switch" aria-label="เสียงเกม" aria-checked={prefs.sound} onClick={setSound}><span/></button></label>
          <button className="road-primary road-start-button" type="submit" disabled={!prefs.name.trim()}><RoadIcon name="flag"/>เริ่มแข่ง</button><small className="road-enter-hint">กด Enter เพื่อเริ่ม</small>
        </form>
        <section className="road-records road-panel"><h2><RoadIcon name="cup"/>สถิติของคุณ</h2><div><span>คะแนนสูงสุด<strong>{String(records.score).padStart(6,'0')}</strong></span><span>ระยะทางไกลสุด<strong>{(records.distance/1000).toFixed(1)} km</strong></span></div></section>
        <RoadControlsGuide/>
      </div>
    </main>{help&&<RoadHelp onClose={()=>setHelp(false)}/>}
  </div>;
}
