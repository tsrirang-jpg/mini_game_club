import {UNDER_MAX_PLAYERS} from '../../../packages/shared/src/undercover';
import type {UnderSettings,UnderSnapshot} from '../../../packages/shared/src/undercover';
import {UndercoverSettings} from './UndercoverSettings';
import {UnderRoster,isUnderPlayerReady} from './UndercoverPanels';
import {LobbyIcon} from './components/ui/LobbyIcon';
import './undercover-lobby.css';

function ReadyProgress({ready,total}:{ready:number;total:number}) {
  return <div className="under-lobby-ready" aria-label={`พร้อมแล้ว ${ready} จาก ${total} คน`}><span>พร้อมแล้ว <strong>{ready}/{total}</strong></span><div className="under-ready-segments" aria-hidden="true">{Array.from({length:total},(_,i)=><i key={i} className={i<ready?'ready':''}/>)}</div></div>;
}

const steps=[
  {icon:'word',title:'รับคำลับ',detail:'แต่ละคนจะได้รับคำลับของตัวเอง'},
  {icon:'chat',title:'อธิบายคำ',detail:'ผลัดกันอธิบายคำลับ โดยไม่พูดตรง ๆ'},
  {icon:'people',title:'โหวตผู้ต้องสงสัย',detail:'ร่วมกันโหวตว่าใครคือ Undercover'},
] as const;

export function UndercoverLobby({s,playerId,connected,onSettings,onReady,onStart}:{s:UnderSnapshot;playerId:string;connected:boolean;onSettings(value:UnderSettings):void;onReady(value:boolean):void;onStart():void}) {
  const host=s.hostId===playerId,me=s.players.find(p=>p.id===playerId);
  const ready=s.players.filter(p=>isUnderPlayerReady(p,s.hostId)).length;
  const minimum=Math.max(3,2*s.undercoverCount+s.whiteCount+1);
  const canStart=s.players.length>=minimum&&ready===s.players.length;
  const waiting=s.players.filter(p=>!isUnderPlayerReady(p,s.hostId));
  const waitingNames=waiting.map(p=>p.name).join(', ');
  const status=!connected?'กำลังเชื่อมต่อใหม่…':s.players.length<minimum?`ต้องมีอย่างน้อย ${minimum} คนสำหรับรูปแบบนี้`:waiting.length?`รอ ${waiting.slice(0,2).map(p=>p.name).join(', ')}${waiting.length>2?` และอีก ${waiting.length-2} คน`:''} ${waiting.some(p=>!p.connected)?'เชื่อมต่อและกดพร้อม':'กดพร้อม'}`:host?'ทุกคนพร้อมแล้ว เริ่มเกมได้เลย':'ทุกคนพร้อมแล้ว รอเจ้าของห้องเริ่มเกม';
  return <section className="under-lobby" aria-labelledby="under-lobby-title">
    <div className="under-lobby-content">
      <header className="under-lobby-heading"><span className="eyebrow">MISSION BRIEFING</span><h1 id="under-lobby-title">ห้องรอ Undercover</h1><p>ส่งรหัสให้เพื่อน · ทุกคนพร้อมแล้วเริ่มพร้อมกัน</p></header>
      <section className="under-lobby-players" aria-labelledby="under-lobby-players-title">
        <div className="under-lobby-players-heading"><h2 id="under-lobby-players-title">ผู้เล่นในห้อง ({s.players.length}/{UNDER_MAX_PLAYERS})</h2><ReadyProgress ready={ready} total={s.players.length}/></div>
        <UnderRoster players={s.players} playerId={playerId} hostId={s.hostId} lobby/>
      </section>
      <aside className="under-lobby-configuration" aria-labelledby="under-lobby-settings-title">
        <header className="under-lobby-panel-heading"><span className="under-lobby-heading-icon"><LobbyIcon name="settings"/></span><div><h2 id="under-lobby-settings-title">ตั้งค่าห้องเกม</h2><p>{host?'ปรับเวลาและจำนวนบทบาทของห้องนี้':'เจ้าของห้องเป็นผู้ตั้งค่ารูปแบบเกม'}</p></div></header>
        <UndercoverSettings value={s} disabled={!host||!connected} onChange={onSettings}/>
        <section className="under-lobby-guide" aria-labelledby="under-lobby-guide-title">
          <header className="under-lobby-panel-heading"><span className="under-lobby-heading-icon"><LobbyIcon name="book"/></span><div><h3 id="under-lobby-guide-title">ภาพรวมการเล่น</h3><p>เข้าใจง่าย ๆ ก่อนเริ่มเกม</p></div></header>
          <ol>{steps.map((step,i)=><li key={step.title}><span className="under-lobby-step-number">{i+1}</span><LobbyIcon name={step.icon}/><strong>{step.title}</strong><p>{step.detail}</p></li>)}</ol>
        </section>
      </aside>
    </div>
    <div className="under-lobby-dock">
      <div className="under-lobby-dock-ready"><span className="under-lobby-dock-icon"><LobbyIcon name="people"/></span><ReadyProgress ready={ready} total={s.players.length}/></div>
      <p className="under-lobby-start-status" role="status" title={waitingNames||undefined}>{status}</p>
      <button type="button" className="primary under-lobby-action" disabled={!connected||(host&&!canStart)} onClick={()=>host?onStart():onReady(!me?.ready)}>{host?<><LobbyIcon name="play"/>เริ่มเกม</>:me?.ready?'ยกเลิกพร้อม':<><LobbyIcon name="check"/>พร้อมเล่น</>}</button>
    </div>
  </section>;
}
