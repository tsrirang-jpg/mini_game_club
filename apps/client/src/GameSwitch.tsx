import { navigate } from './router';

export function GameSwitch() {
  return <button type="button" className="ghost entry-game-switch" onClick={() => navigate('/games')}>← เลือกเกมอื่น</button>;
}
