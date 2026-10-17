import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice, EntryFacts } from './components/entry/RoomEntryForm';
import { DesktopEntryHero } from './DesktopEntryHero';
import { GameSwitch } from './GameSwitch';
import { GameArtwork } from './GameArtwork';
import { pokerSession } from './session';
import type { SessionState } from './session';
import type { PokerSnapshot } from '../../../packages/shared/src/poker';
import { navigate } from './router';
import { PokerRules } from './PokerRules';
export function PokerCreatePage({ state, join }: { state: SessionState<PokerSnapshot>; join: boolean }) {
  return <main className="welcome poker-welcome desktop-entry-welcome"><DesktopEntryHero game="poker"><div className="intro"><span className="eyebrow">TEXAS HOLD’EM · NO-LIMIT</span><h1>อ่านเกมให้ขาด<br/>แล้วเลือกตาของคุณ<span>Poker ในวงไพ่</span></h1><p>Blinds 10/20 · ชิปเริ่มต้น 1,000<br/>เพื่อนและบอทรวม 2–6 คน · แต้มจำลอง</p><button className="ghost" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button></div></DesktopEntryHero>
    <section className="entry"><GameSwitch/><GameArtwork game="poker"/><span className="eyebrow desktop-only">POKER</span><h2>{join ? 'เข้าห้อง Poker' : 'สร้างห้อง Poker'}</h2><RoomEntryTabs basePath="/poker/rooms" join={join}/>
      <CurrentRoomNotice code={state.snapshot?.code} playPath="/poker/play" leave={() => pokerSession.leave()}/>
      <RoomEntryForm join={join} status={state.status} createText="สร้างโต๊ะ Poker →" joinText="เข้าร่วมโต๊ะ Poker →" connect={(name,code,botCount) => pokerSession.connect(name,code,botCount)} defaultBots={1} botLimit={6} facts={<EntryFacts items={[["ผู้เล่น","2–6 คน"],["Blinds","10/20"],["เริ่มต้น","1,000 ชิป"]]}/>}/><p className="fine"><span className="entry-extra-note">ไพ่ส่วนตัว 2 ใบ + ไพ่กลาง 5 ใบ เลือกมือดีที่สุด 5 ใบ<br/></span>Fold · Check · Call · Raise · All-in<span className="entry-extra-note"><br/>รองรับ side pot และแบ่งชิปเมื่อเสมอ</span></p><PokerRules/></section></main>;
}
