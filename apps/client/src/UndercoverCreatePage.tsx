import {useState} from 'react';
import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {UndercoverSettings} from './UndercoverSettings';
import {UndercoverRules} from './components/entry/UndercoverRules';
import {underSession} from './session';
import type {SessionState} from './session';
import {UNDER_DEFAULT_SETTINGS} from '../../../packages/shared/src/undercover';
import type {UnderSnapshot, UnderSettings} from '../../../packages/shared/src/undercover';
import './undercover.css';
export function UndercoverCreatePage({state, join}: {state: SessionState<UnderSnapshot>; join: boolean}) {
  const [settings, setSettings] = useState<UnderSettings>(() => ({...UNDER_DEFAULT_SETTINGS}));
  return <RoomEntryPage game="undercover" state={state} join={join} rules={<UndercoverRules/>}
    leave={() => underSession.leave()}
    connect={(name, code) => underSession.connect(name, code, 0, {...settings})}
    createSettings={<UndercoverSettings value={settings} disabled={state.status !== 'idle'} onChange={setSettings}/>}/>;
}
