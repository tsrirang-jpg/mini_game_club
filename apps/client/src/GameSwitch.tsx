import { navigate } from './router';

export function GameSwitch({ inRoom = false }: { inRoom?: boolean }) {
  return <button type="button" className={`ghost ${inRoom ? 'room-game-switch' : 'entry-game-switch'}`} onClick={() => navigate('/games')}>← เลือกเกมอื่น</button>;
}
