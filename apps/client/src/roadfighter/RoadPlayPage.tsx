import {useCallback,useEffect,useMemo,useState} from 'react';
import {navigate} from '../router';
import {RoadEngine,DIFFICULTIES,ROAD,STAGES} from './engine';
import {loadPreferences,loadRecords,savePreferences,saveRecords} from './storage';
import {useRoadControls} from './useRoadControls';
import {useRoadAudio} from './useRoadAudio';
import {ArcadeHeader} from './ArcadeHeader';
import {Gauge} from './Gauge';
import {RoadIcon} from './RoadIcon';
import {RoadTrack} from './RoadTrack';
import {RoadControlsGuide,RoadHelp} from './RoadHelp';
import type {RaceView} from './engine';
import './roadfighter.css';
const score=(n:number)=>String(Math.floor(n)).padStart(6,'0').replace(/(\d)(?=(\d{3})+$)/g,'$1,');
const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0');
function RaceHud({view,best,name,max}:{view:RaceView;best:number;name:string;max:number}){return <aside className="road-hud" aria-label="สถานะการแข่งขัน"><div className="road-profile road-panel"><RoadIcon name="user"/>{name} · คุณ</div><div className="road-instruments road-panel"><section className="road-speed"><h2>ความเร็ว</h2><Gauge kind="speed" value={view.speed} max={max}/></section><section className={'road-fuel'+(view.fuel<20?' low-fuel':'')}><h2><RoadIcon name="fuel"/>FUEL</h2><Gauge kind="fuel" value={view.fuel}/></section><section className="road-score"><h2><RoadIcon name="cup"/>SCORE</h2><strong className="road-number" data-testid="road-score">{score(view.score)}</strong></section><section className="road-time"><h2><RoadIcon name="clock"/>TIME</h2><strong className="road-number">{clock(view.time)}</strong></section><section className="road-best"><h2><RoadIcon name="cup"/>BEST</h2><strong className="road-number">{score(Math.max(best,view.score))}</strong></section></div></aside>;}
function RaceGoals({view}:{view:RaceView}){const progress=Math.min(100,view.stageDistance/ROAD.stageDistance*100);return <section className="road-goals road-panel"><h2><RoadIcon name="flag"/>เป้าหมาย</h2><div><RoadIcon name="car"/><span>แซงรถ<strong>{view.overtakes}<small> / 20</small></strong><progress value={Math.min(view.overtakes,20)} max={20} aria-label="จำนวนรถที่แซง"/></span></div><div><RoadIcon name="road"/><span>ระยะทาง<strong>{(view.stageDistance/1000).toFixed(1)}<small> / 4.0 km</small></strong><progress value={progress} max={100} aria-label="ระยะทางด่านปัจจุบัน"/></span></div></section>;}
export function RoadPlayPage(){
  const [prefs,setPrefs]=useState(loadPreferences),[records,setRecords]=useState(loadRecords),[run,setRun]=useState(0),[help,setHelp]=useState(false);
  const engine=useMemo(()=>new RoadEngine(prefs.difficulty),[prefs.difficulty,run]);
  const [view,setView]=useState(()=>engine.view);const update=useCallback(()=>setView(engine.view),[engine]);
  const controls=useRoadControls(engine,update);useRoadAudio(engine,prefs.sound);
  useEffect(()=>{update();},[engine,update]);
  useEffect(()=>{if(view.phase==='finished'||view.phase==='gameover')setRecords(saveRecords(view.score,view.distance));},[view.phase,view.score,view.distance]);
  const togglePause=()=>{controls.reset();engine.togglePause();update();};
  const restart=()=>{controls.reset();setRun(n=>n+1);};
  const sound=()=>setPrefs(p=>{const next={...p,sound:!p.sound};savePreferences(next);return next;});
  const openHelp=()=>{controls.reset();engine.pause();update();setHelp(true);};
  const over=view.phase==='finished'||view.phase==='gameover';
  const progress=Math.min(100,view.stageDistance/ROAD.stageDistance*100);
  return <div className="arcade-shell road-play-page" data-phase={view.phase} data-player-x={view.playerX.toFixed(1)}>
    <ArcadeHeader sound={prefs.sound} onSound={sound} onHelp={openHelp} onPause={togglePause} paused={view.phase==='paused'}/>
    <main className="road-race-grid"><RaceHud view={view} name={prefs.name} best={records.score} max={DIFFICULTIES[prefs.difficulty].maxSpeed}/>
      <section className="road-track-frame" aria-label="สนามแข่ง Road Fighter"><div className="road-race-progress"><strong>STAGE {String(view.stage+1).padStart(2,'0')}</strong><span><progress max={100} value={progress} aria-label="ความคืบหน้าของด่าน"/><RoadIcon name="car" style={{left:Math.min(95,progress)+'%'}}/></span><RoadIcon name="flag"/><b>{Math.floor(progress)}%</b></div>
        <RoadTrack engine={engine} onUpdate={update}/>
        {view.phase==='countdown'&&<div className="road-race-overlay road-countdown" role="status"><span>เตรียมออกตัว</span><strong>{view.countdown||'GO!'}</strong><small>กด W หรือปุ่มเร่งเพื่อเพิ่มความเร็ว</small></div>}
        {view.phase==='crashed'&&<div className="road-crash-message" role="status">ชน! เสียน้ำมัน {DIFFICULTIES[prefs.difficulty].hitCost}%</div>}
        {view.phase==='paused'&&!help&&<div className="road-race-overlay"><div className="road-overlay-card"><RoadIcon name="pause"/><h1>พักเกม</h1><p>พร้อมแล้วกลับมาลุยต่อได้เลย</p><button className="road-primary" onClick={togglePause}><RoadIcon name="play"/>เล่นต่อ</button><button onClick={()=>navigate('/road-fighter')}>กลับหน้าเริ่มเกม</button></div></div>}
        {over&&<div className="road-race-overlay"><div className="road-overlay-card" role="status"><RoadIcon name={view.phase==='finished'?'flag':'fuel'}/><h1>{view.phase==='finished'?'เข้าเส้นชัยแล้ว!':'น้ำมันหมด'}</h1><p>{view.phase==='finished'?'ผ่านครบทั้ง 3 ด่าน':'เติมพลังแล้วลองทำสถิติใหม่'}</p><strong className="road-number">{score(view.score)}</strong><p>{(view.distance/1000).toFixed(2)} km · {clock(view.time)} · แซง {view.overtakes} คัน</p><button className="road-primary" onClick={restart}><RoadIcon name="restart"/>เล่นใหม่</button><button onClick={()=>navigate('/road-fighter')}>กลับหน้าเริ่มเกม</button></div></div>}
      </section>
      <aside className="road-sidebar"><RaceGoals view={view}/><RoadControlsGuide/><section className="road-stage-card road-panel"><h2>STAGE {String(view.stage+1).padStart(2,'0')}</h2><RoadTrack preview/><strong>{STAGES[view.stage].name}</strong></section></aside>
    </main>
    <footer className="road-game-footer"><p><RoadIcon name="flag"/>หลบรถ · เก็บน้ำมัน · ไปให้ถึงเส้นชัย</p><div className="road-touch-controls" aria-label="ปุ่มควบคุมรถ"><button aria-label="เลี้ยวซ้าย" {...controls.bind('left')} disabled={over||view.phase==='paused'}><RoadIcon name="left"/></button><button aria-label="เลี้ยวขวา" {...controls.bind('right')} disabled={over||view.phase==='paused'}><RoadIcon name="right"/></button><button aria-label="เบรก" {...controls.bind('brake')} disabled={over||view.phase==='paused'}><RoadIcon name="brake"/><span>เบรก</span></button><button className="road-primary" aria-label="เร่งความเร็ว" {...controls.bind('accelerate')} disabled={over||view.phase==='paused'}><RoadIcon name="accelerate"/><span>เร่ง</span></button></div><div className="road-footer-actions"><button onClick={togglePause} disabled={over}><RoadIcon name={view.phase==='paused'?'play':'pause'}/>{view.phase==='paused'?'เล่นต่อ':'พักเกม'}</button><button className="road-primary" onClick={restart}><RoadIcon name="restart"/>เล่นใหม่</button></div></footer>
    {help&&<RoadHelp onClose={()=>setHelp(false)}/>}
  </div>;
}
