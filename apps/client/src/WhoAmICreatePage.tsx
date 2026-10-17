import './whoami.css';
import { useState } from 'react';
import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice, EntryFacts } from './components/entry/RoomEntryForm';
import { GameSwitch } from './GameSwitch';
import { WhoAmIArtwork } from './WhoAmIArtwork';
import { WhoAmISettingsFields } from './WhoAmISettingsFields';
import { WhoAmIRules } from './components/entry/WhoAmIRules';
import { whoAmISession } from './session';
import type { SessionState } from './session';
import { WHO_DEFAULT_SETTINGS } from '../../../packages/shared/src/whoami';
import type { WhoSettings, WhoSnapshot } from '../../../packages/shared/src/whoami';
export function WhoAmICreatePage({state,join}:{state:SessionState<WhoSnapshot>;join:boolean}) {
  const [settings,setSettings]=useState<WhoSettings>(()=>({...WHO_DEFAULT_SETTINGS}));
  return <main className="who-welcome">
    <nav className="who-entry-navigation" aria-label="เลือกเกม"><GameSwitch/></nav>
    <section className="who-intro"><div><span className="eyebrow">WHO AM I</span><h1>ฉันคือใคร?</h1><h2>ถามให้ตรงจุด แล้วทายตัวตนของคุณ</h2><p>เพื่อนเห็นคำของคุณ แต่คุณต้องทายเอง</p></div><WhoAmIArtwork eager/></section>
    <section className="entry who-entry"><h2>{join?'เข้าห้อง Who am I':'สร้างห้อง Who am I'}</h2>
      <RoomEntryTabs basePath="/whoami/rooms" join={join}/>
      <CurrentRoomNotice code={state.snapshot?.code} playPath="/whoami/play" leave={()=>whoAmISession.leave()}/>
      <RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Who am I →" joinText="เข้าห้อง Who am I →" connect={(name,code,bots)=>whoAmISession.connect(name,code,bots,{...settings})}
        createSettings={<WhoAmISettingsFields value={settings} disabled={state.status!=='idle'} onChange={setSettings}/>}
        facts={<EntryFacts items={[["ผู้เล่น","3–8 คน"]]}/>} factsOnJoin={false}
        joinHint={<p className="fine">ตั้งค่าจำนวนรอบตามผู้สร้างห้อง · ผู้เล่นจริง 3–8 คน</p>}/>
      <WhoAmIRules/>
    </section>
  </main>;
}
