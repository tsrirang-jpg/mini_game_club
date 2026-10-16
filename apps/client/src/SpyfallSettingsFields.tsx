import { SPY_QUESTION_MINUTES, SPY_TURN_MINUTES } from '../../../packages/shared/src/spyfall';
import type { SpySettings, SpySettingKey } from '../../../packages/shared/src/spyfall';
import { SpyfallSelect } from './SpyfallSelect';

export function SpyfallSettingsFields({ value, onChange, disabled = false }: {
  value: SpySettings; onChange(key: SpySettingKey, value: number): void; disabled?: boolean;
}) {
  const minutes = SPY_TURN_MINUTES.map(value => ({ value, label: `${value} นาที` }));
  return <div className="spy-settings-fields">
    <SpyfallSelect label="เวลาถามตอบ" value={value.questionMinutes} options={SPY_QUESTION_MINUTES.map(value => ({ value, label: `${value} นาที` }))} disabled={disabled} onChange={value => onChange('questionMinutes', value)}/>
    <div className="spy-setting-selects">
      <SpyfallSelect compact label="โหวต" value={value.votingMinutes} options={minutes} disabled={disabled} onChange={value => onChange('votingMinutes', value)}/>
      <SpyfallSelect compact label="สายลับตอบ" value={value.guessMinutes} options={minutes} disabled={disabled} onChange={value => onChange('guessMinutes', value)}/>
      <div className="spy-player-summary"><span>ผู้เล่น</span><strong>3–{value.playerCount} คน</strong></div>
    </div>
  </div>;
}
