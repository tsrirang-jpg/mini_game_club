import {useState} from 'react';
import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {spySession} from './session';
import type {SessionState} from './session';
import {SPY_DEFAULT_SETTINGS} from '../../../packages/shared/src/spyfall';
import type {SpySnapshot, SpySettings} from '../../../packages/shared/src/spyfall';
import {SpyfallRules} from './SpyfallRules';
import {SpyfallSettingsFields} from './SpyfallSettingsFields';
export function SpyfallCreatePage({state, join}: {state: SessionState<SpySnapshot>; join: boolean}) {
  const [settings, setSettings] = useState<SpySettings>(() => ({...SPY_DEFAULT_SETTINGS}));
  return <RoomEntryPage game="spyfall" state={state} join={join} rules={<SpyfallRules/>}
    leave={() => spySession.leave()}
    connect={(name, code, bots) => spySession.connect(name, code, bots, {...settings})}
    createSettings={<SpyfallSettingsFields value={settings} disabled={state.status !== 'idle'}
      onChange={(key, value) => setSettings(previous => ({...previous, [key]: value}))}/>}/>;
}
