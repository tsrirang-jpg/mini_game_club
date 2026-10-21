import {RoomEntryPage} from './components/entry/RoomEntryPage';
import {session} from './session';
import type {SessionState} from './session';
import {Rules} from './components';
export function CreateRoomPage({state, join}: {state: SessionState; join: boolean}) {
  return <RoomEntryPage game="pok" state={state} join={join} rules={<Rules/>}
    leave={() => session.leave()} connect={(name, code, bots) => session.connect(name, code, bots)}/>;
}
