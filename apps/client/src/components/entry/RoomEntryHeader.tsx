import {BrandLogo} from '../ui/BrandLogo';
import {RoadIcon} from '../../roadfighter/RoadIcon';
import {navigate} from '../../router';

export function RoomEntryHeader({onHelp}: {onHelp(): void}) {
  return <header className="top room-entry-header">
    <button type="button" className="ghost entry-game-switch" aria-label="เลือกเกมอื่น" onClick={() => navigate('/games')}>
      <RoadIcon name="back"/><span>เลือกเกมอื่น</span>
    </button>
    <a className="brand" href="/games" aria-label="วงเซียน · Mini Game Club"
      onClick={event => {event.preventDefault(); navigate('/games');}}><BrandLogo/></a>
    <nav className="tag room-entry-tools" aria-label="เมนูเกม">
      <button type="button" aria-label="วิธีเล่น" onClick={onHelp}><RoadIcon name="help"/><span>วิธีเล่น</span></button>
    </nav>
  </header>;
}
