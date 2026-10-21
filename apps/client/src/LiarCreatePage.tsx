import {useState} from 'react';
import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {LIAR_TURN_SECONDS} from '../../../packages/shared/src/liar';
import type {LiarSnapshot} from '../../../packages/shared/src/liar';
import {liarSession} from './session';
import type {SessionState} from './session';
import {SpyfallSelect} from './SpyfallSelect';
import {LiarRules} from './components/entry/LiarRules';
import './liar.css';
const turnOptions = LIAR_TURN_SECONDS.map(value => ({value, label: `${value} วินาที${value === 30 ? ' (แนะนำ)' : ''}`}));
export function LiarCreatePage({state, join}: {state: SessionState<LiarSnapshot>; join: boolean}) {
  const [turnSeconds, setTurnSeconds] = useState(30);
  return <RoomEntryPage game="liar" state={state} join={join} rules={<LiarRules/>}
    leave={() => liarSession.leave()}
    connect={(name, code, bots) => liarSession.connect(name, code, bots, {turnSeconds})}
    createSettings={<SpyfallSelect<number> label="เวลาต่อเทิร์น" value={turnSeconds} options={turnOptions}
      onChange={setTurnSeconds} disabled={state.status !== 'idle'}/>}/>;
}
