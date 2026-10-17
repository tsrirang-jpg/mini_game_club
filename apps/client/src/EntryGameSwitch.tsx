import { navigate } from './router';

export function EntryGameSwitch() {
  return <button type="button" className="ghost entry-game-switch" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button>;
}
