import { RoomEntryForm, RoomEntryTabs, CurrentRoomNotice, EntryFacts } from './components/entry/RoomEntryForm';
import { GameSwitch } from './GameSwitch';
import { GameArtwork } from './GameArtwork';
import { session } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { Card, Rules } from './components';
export function CreateRoomPage({ state, join }: { state: SessionState; join: boolean }) {
  return (<main className="welcome">
      <button className="ghost pok-home" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button>
      <div className="intro"><span className="eyebrow">ชวนเพื่อนมาเข้าวง</span><h1>ไพ่หนึ่งสำรับ<br/>ความสนุกทั้งวง<span>ป๊อกเด้งออนไลน์</span></h1><p>สร้างโต๊ะ ส่งรหัสให้เพื่อน แล้วเริ่มเล่น<br/>เปิดผ่าน browser ได้เลย เล่นกับเพื่อนหรือบอท รวม 2–6 คน</p><div className="hero-cards"><Card card={{ rank: 9, suit: 'spades' }}/><Card card={{ rank: 13, suit: 'hearts' }} index={1}/></div></div>
      <section className="entry"><GameSwitch/><GameArtwork game="pok"/><span className="eyebrow">POK DENG</span><h2>{join ? 'เข้าห้องป๊อกเด้ง' : 'ป๊อกเด้ง'}</h2><RoomEntryTabs basePath="/rooms" join={join}/>
        <CurrentRoomNotice code={state.snapshot?.code} playPath="/play" leave={() => session.leave()} prefix="คุณยังอยู่ในห้อง "/>
        <RoomEntryForm join={join} status={state.status} createText="สร้างโต๊ะใหม่ →" joinText="เข้าร่วมโต๊ะ →" connect={(name,code,botCount) => session.connect(name,code,botCount)} defaultBots={0} botLimit={6} namePlaceholder="เพื่อนจะเห็นชื่อนี้" codePlaceholder="เช่น A1B2C3D4E5" facts={<EntryFacts items={[["ผู้เล่น","2–6 คน"],["เริ่มต้น","1,000 แต้ม"]]}/>}/><p className="muted">เริ่มต้นคนละ 1,000 แต้ม ไม่มีเงินจริง</p><Rules/>
      </section>
    </main>);
}
