import {useState} from 'react';
import {RoomEntryForm,RoomEntryTabs,CurrentRoomNotice} from './components/entry/RoomEntryForm';
import {GameSwitch} from './GameSwitch';
import {UndercoverSettings} from './UndercoverSettings';
import {UndercoverRules} from './components/entry/UndercoverRules';
import {entryImages} from './assets/images';
import {games} from './games';
import {underSession} from './session';
import type {SessionState} from './session';
import {UNDER_DEFAULT_SETTINGS} from '../../../packages/shared/src/undercover';
import type {UnderSnapshot,UnderSettings} from '../../../packages/shared/src/undercover';
import './undercover.css';
export function UndercoverCreatePage({state,join}:{state:SessionState<UnderSnapshot>;join:boolean}){
 const [settings,setSettings]=useState<UnderSettings>(()=>({...UNDER_DEFAULT_SETTINGS}));
 return <main className="under-entry-page desktop-entry-welcome">
  <nav className="entry-navigation" aria-label="เลือกเกม"><GameSwitch/></nav>
  <div className="under-entry-layout desktop-entry-content">
   <section className="under-entry-hero entry-hero" aria-label="เกี่ยวกับ Undercover">
    <div><h1>Undercover</h1><h2>{games.undercover.copy}</h2><p className="under-entry-players">ผู้เล่น 3–8 คน</p><p>ใช้คำพูด อธิบายให้เนียน<br/>จับพิรุธ ใครคือสายลับ</p></div>
    <img className="entry-hero-art" {...entryImages.undercover} alt="ตัวละครสามคน โทนดำ ทอง และขาว" fetchPriority="high" decoding="async"/>
   </section>
   <section className="entry under-entry-form" aria-label={join?'เข้าห้อง Undercover':'สร้างห้อง Undercover'}>
    <span className="eyebrow">UNDERCOVER</span><h2>{join?'เข้าห้อง Undercover':'สร้างห้อง Undercover'}</h2>
    <RoomEntryTabs basePath="/undercover/rooms" join={join}/>
    <CurrentRoomNotice code={state.snapshot?.code} playPath="/undercover/play" leave={()=>underSession.leave()}/>
    <RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Undercover →" joinText="เข้าห้อง Undercover →" connect={(name,code)=>underSession.connect(name,code,0,{...settings})} factsOnJoin={false} createSettings={<UndercoverSettings value={settings} disabled={state.status!=='idle'} onChange={setSettings}/>} joinHint={<p className="fine">เข้าห้องแล้วกดพร้อม รอเพื่อนเริ่มพร้อมกัน</p>}/>
    <UndercoverRules/>
   </section>
  </div>
 </main>;
}
