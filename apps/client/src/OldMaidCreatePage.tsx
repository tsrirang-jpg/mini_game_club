import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {OldMaidRules} from './components/entry/OldMaidRules';
export {OldMaidRules} from './components/entry/OldMaidRules';
import {oldMaidSession} from './session';
import type {SessionState} from './session';
import type {OldMaidSnapshot} from '../../../packages/shared/src/oldmaid';
export function OldMaidCreatePage({state, join}: {state: SessionState<OldMaidSnapshot>; join: boolean}) {
  return <RoomEntryPage game="oldmaid" state={state} join={join} rules={<OldMaidRules/>}
    leave={() => oldMaidSession.leave()} connect={(name, code, bots) => oldMaidSession.connect(name, code, bots)}/>;
}
