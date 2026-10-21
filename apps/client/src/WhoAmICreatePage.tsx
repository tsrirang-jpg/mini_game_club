import {useState} from 'react';
import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {WhoAmISettingsFields} from './WhoAmISettingsFields';
import {WhoAmIRules} from './components/entry/WhoAmIRules';
import {whoAmISession} from './session';
import type {SessionState} from './session';
import {WHO_DEFAULT_SETTINGS} from '../../../packages/shared/src/whoami';
import type {WhoSettings, WhoSnapshot} from '../../../packages/shared/src/whoami';
import './whoami.css';
export function WhoAmICreatePage({state, join}: {state: SessionState<WhoSnapshot>; join: boolean}) {
  const [settings, setSettings] = useState<WhoSettings>(() => ({...WHO_DEFAULT_SETTINGS}));
  return <RoomEntryPage game="whoami" state={state} join={join} rules={<WhoAmIRules/>}
    leave={() => whoAmISession.leave()}
    connect={(name, code, bots) => whoAmISession.connect(name, code, bots, {...settings})}
    createSettings={<WhoAmISettingsFields value={settings} disabled={state.status !== 'idle'} onChange={setSettings}/>}/>;
}
