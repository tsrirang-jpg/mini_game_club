import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice } from './components/entry/RoomEntryForm';
import { DesktopEntryHero } from './DesktopEntryHero';
import { GameArtwork } from './GameArtwork';
import { useState } from 'react';
import { spySession } from './session';
import type { SessionState } from './session';
import type { SpySnapshot, SpySettings } from '../../../packages/shared/src/spyfall';
import { SPY_DEFAULT_SETTINGS } from '../../../packages/shared/src/spyfall';
import { SpyfallRules } from './SpyfallRules';
import { SpyfallSettingsFields } from './SpyfallSettingsFields';
export function SpyfallCreatePage({ state, join }: { state: SessionState<SpySnapshot>; join: boolean }) {
  const [settings,setSettings] = useState<SpySettings>(() => ({ ...SPY_DEFAULT_SETTINGS }));
  return <main className="welcome spy-welcome desktop-entry-welcome"><DesktopEntryHero game="spyfall" showMobileNavigation><section className="intro"><span className="eyebrow">SPYFALL · SOCIAL DEDUCTION</span><div className="spy-emblem" aria-hidden="true">◉</div><h1>หนึ่งคนมีความลับ<br/>ทั้งห้องมีคำถาม<span>ใครคือสายลับ?</span></h1><p>ถามให้ฉลาด ตอบให้เนียน แล้วจับพิรุธ<br/>ผู้เล่นจริง 3–8 คน · บทบาทลับ · แชตในเกม</p></section></DesktopEntryHero>
    <section className="entry"><GameArtwork game="spyfall"/><span className="eyebrow">MISSION BRIEFING</span><h2>{join ? 'เข้าห้อง Spyfall' : 'สร้างห้อง Spyfall'}</h2><RoomEntryTabs basePath="/spyfall/rooms" join={join}/>
      <CurrentRoomNotice code={state.snapshot?.code} playPath="/spyfall/play" leave={() => spySession.leave()}/>
      <RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Spyfall →" joinText="เข้าร่วมภารกิจ →" connect={(name,code,botCount) => spySession.connect(name,code,botCount, {...settings})} createSettings={<SpyfallSettingsFields value={settings} disabled={state.status !== "idle"} onChange={(key,value) => setSettings(previous => ({ ...previous, [key]: value }))}/>} joinHint={<p className="fine">ผู้เล่น 3–8 คน · เวลาใช้ตามที่ผู้สร้างห้องกำหนด</p>}/><SpyfallRules/></section></main>;
}
