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
 return <main className="under-entry-page"><nav aria-label="เลือกเกม"><GameSwitch/></nav><div className="under-entry-layout"><section className="under-entry-hero"><img {...entryImages.undercover} alt="ตัวละครสามคนกับแฟ้มภารกิจ โทนดำ ทอง และขาว" fetchPriority="high"/><div><span className="eyebrow">COVERT WORDS</span><h1>Undercover</h1><h2>คนไหนอยู่คนละฝั่ง?</h2><p>{games.undercover.copy}</p></div></section><section className="entry under-entry-form"><RoomEntryTabs basePath="/undercover/rooms" join={join}/><CurrentRoomNotice code={state.snapshot?.code} playPath="/undercover/play" leave={()=>underSession.leave()}/><RoomEntryForm join={join} status={state.status} createText="สร้างห้อง Undercover →" joinText="เข้าห้อง Undercover →" connect={(name,code)=>underSession.connect(name,code,0,{...settings})} factsOnJoin={false} createSettings={<UndercoverSettings value={settings} disabled={state.status!=='idle'} onChange={setSettings}/>} joinHint={<p className="fine">กดพร้อมเมื่อเข้าห้อง แล้วรอผู้สร้างห้องเริ่มพร้อมกัน</p>}/><UndercoverRules/></section></div></main>;
}
