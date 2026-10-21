import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {pokerSession} from './session';
import type {SessionState} from './session';
import type {PokerSnapshot} from '../../../packages/shared/src/poker';
import {PokerRules} from './PokerRules';
export function PokerCreatePage({state, join}: {state: SessionState<PokerSnapshot>; join: boolean}) {
  return <RoomEntryPage game="poker" state={state} join={join} rules={<PokerRules/>}
    leave={() => pokerSession.leave()} connect={(name, code, bots) => pokerSession.connect(name, code, bots)}/>;
}
