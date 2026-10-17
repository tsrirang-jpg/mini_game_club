import { OldMaidRules } from './components/entry/OldMaidRules';
export { OldMaidRules } from './components/entry/OldMaidRules';
import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice, EntryFacts } from './components/entry/RoomEntryForm';
import { DesktopEntryHero } from './DesktopEntryHero';
import { GameSwitch } from './GameSwitch';
import { oldMaidSession } from './session';
import type { SessionState } from './session';
import type { OldMaidSnapshot } from '../../../packages/shared/src/oldmaid';
import { navigate } from './router';
import { GameArtwork } from './GameArtwork';

export function OldMaidCreatePage({state,join}: {state:SessionState<OldMaidSnapshot>;join:boolean}) {
  return <main className="welcome oldmaid-welcome desktop-entry-welcome"><DesktopEntryHero game="oldmaid"><section className="intro"><span className="eyebrow">OLD MAID · อีแก่กินน้ำ</span><h1>จับคู่ให้หมดมือ<span>ใครจะเหลือใบสุดท้าย?</span></h1><p>สุ่มไพ่ไร้คู่ทุกรอบ · เพื่อนและบอทรวม 3–8 คน</p><GameArtwork game="oldmaid"/><button className="ghost" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button></section></DesktopEntryHero><section className="entry"><GameSwitch/><GameArtwork game="oldmaid"/><span className="eyebrow">OLD MAID</span><h2>{join?'เข้าห้อง Old Maid':'อีแก่กินน้ำ'}</h2><RoomEntryTabs basePath="/oldmaid/rooms" join={join}/><CurrentRoomNotice code={state.snapshot?.code} playPath="/oldmaid/play" leave={() => oldMaidSession.leave()}/><RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Old Maid →" joinText="เข้าร่วมวง Old Maid →" connect={(name,code,botCount) => oldMaidSession.connect(name,code,botCount)} defaultBots={2} botLimit={8} factsOnJoin={false} facts={<EntryFacts items={[["ผู้เล่น","3–8 คน"],["ผลัดกันจั่ว","ทีละ 1 ใบ"],["จับคู่แล้ว","ทิ้งอัตโนมัติ"]]}/>}/><p className="fine desktop-only">จับคู่ให้หมดมือ ใครเหลือใบสุดท้ายแพ้</p><OldMaidRules/></section></main>;
}
