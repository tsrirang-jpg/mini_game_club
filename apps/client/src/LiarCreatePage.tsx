import { useState } from 'react';
import type { SessionState } from './session';
import type { LiarSnapshot } from '../../../packages/shared/src/liar';
import { LIAR_TURN_SECONDS } from '../../../packages/shared/src/liar';
import { liarSession } from './session';
import { entryImages } from './assets/images';
import { GameSwitch } from './GameSwitch';
import { SpyfallSelect } from './SpyfallSelect';
import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice } from './components/entry/RoomEntryForm';
import { LiarRules } from './components/entry/LiarRules';
import './liar.css';

const turnOptions=LIAR_TURN_SECONDS.map(value=>({value,label:`${value} วินาที${value===30?' (แนะนำ)':''}`}));
export function LiarCreatePage({state,join}:{state:SessionState<LiarSnapshot>;join:boolean}) {
  const [turnSeconds,setTurnSeconds]=useState<number>(30);
  return <main className="liar-entry-page">
    <nav aria-label="เลือกเกม"><GameSwitch/></nav>
    <div className="liar-entry-layout">
      <section className="liar-entry-hero"><img src={entryImages.liar.src} width={1000} height={667} alt="ไพ่สีม่วงข้างโคมไฟ" fetchPriority="high"/><div><span className="eyebrow">ไพ่ตอแหล</span><h1>Liar’s Card</h1><p>{join?'รวมเพื่อนมาจับโกหก ใครจะไพ่หมดมือก่อน?':'วางไพ่ ข้ามไพ่ จับโกหกให้ทัน'}<br/>สนุกกับเพื่อนและบอท 2–6 คน</p></div></section>
      <section className="entry liar-entry-form" aria-label={join?'เข้าห้อง Liar’s Card':'สร้างห้อง Liar’s Card'}>
        <RoomEntryTabs basePath="/liar/rooms" join={join}/>
        <CurrentRoomNotice code={state.snapshot?.code} playPath="/liar/play" leave={()=>liarSession.leave()}/>
        <RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Liar’s Card →" joinText="เข้าห้อง Liar’s Card →" botLimit={6} defaultBots={0}
          connect={(name,code,bots)=>liarSession.connect(name,code,bots,{turnSeconds})}
          codePlaceholder="กรอกรหัสห้อง 10 ตัวอักษร"
          createSettings={<SpyfallSelect<number> label="เวลาต่อเทิร์น" value={turnSeconds} options={turnOptions} onChange={setTurnSeconds} disabled={state.status!=='idle'}/>}
          factsOnJoin={false} facts={<p className="liar-entry-hint">♟ ผู้เล่นทั้งหมด 2–6 คน<br/><small>รวมคุณ เพื่อน และบอท · จับโกหกภายใน 5 วินาที</small></p>}
          joinHint={<p className="liar-entry-hint">เมื่อเข้าห้องแล้ว กรุณากดพร้อมเล่น<br/><small>รอผู้สร้างห้องเริ่มเกมด้วยกัน</small></p>}/>
        <LiarRules/>
      </section>
    </div>
  </main>;
}
