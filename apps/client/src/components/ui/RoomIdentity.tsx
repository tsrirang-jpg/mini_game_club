import { BrandLogo } from './BrandLogo';
import { CopyRoomCodeButton } from './CopyRoomCodeButton';

// The shared club-room-id layout stacks brand/code on portrait phones and
// keeps the copy control beside both rows; desktop stays on a single row.
export function RoomIdentity({code,codeClassName}:{code:string;codeClassName?:string}) {
  return <div className="club-room-id"><BrandLogo compact/><strong className={codeClassName}>{code}</strong><CopyRoomCodeButton code={code}/></div>;
}
