import type { Phase } from '../../../../../packages/shared/src/index';
import { phaseLabel } from '../../components';
import { PokMedallion } from './PokArenaArtwork';
export function PokTurnStage({phase,canAct,dealer,canCatch}:{phase:Phase;canAct:boolean;dealer:boolean;canCatch:boolean}) {
  const step=phase==='LOBBY'?-1:phase==='DEALING'?0:['PLAYER_ACTIONS','DEALER_ACTION'].includes(phase)?1:2;
  return <section className="pok-turn-stage">
    <PokMedallion/>
    <h1>{canAct?canCatch?'เลือกจับ จั่ว หรืออยู่':dealer?'ตาเจ้ามือ เลือกไพ่':'รอคุณเลือกไพ่':phaseLabel[phase]}</h1>
    <div className="arena-steps" aria-label="ลำดับการเล่น">{['แจกไพ่','เลือกไพ่','สรุปผล'].map((label,i)=><span key={label} className={i===step?'current':i<step?'complete':''} aria-current={i===step?'step':undefined}><i/>{label}</span>)}</div>
  </section>;
}
