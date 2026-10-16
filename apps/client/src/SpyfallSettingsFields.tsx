import { SPY_QUESTION_MINUTES, SPY_TURN_MINUTES, SPY_PLAYER_COUNTS } from '../../../packages/shared/src/spyfall';
import type { SpySettings, SpySettingKey } from '../../../packages/shared/src/spyfall';
import { SpyfallSelect } from './SpyfallSelect';

export function SpyfallSettingsFields({ value, onChange, disabled = false, currentPlayers = 0 }: {
  value: SpySettings; onChange(key: SpySettingKey, value: number): void; disabled?: boolean; currentPlayers?: number;
}) {
  const minutes = SPY_TURN_MINUTES.map(value => ({ value, label: `${value} นาที` }));
  return <div className="spy-settings-fields">
    <SpyfallSelect label="เวลาถามตอบ" value={value.questionMinutes} options={SPY_QUESTION_MINUTES.map(value => ({ value, label: `${value} นาที` }))} disabled={disabled} onChange={value => onChange('questionMinutes', value)}/>
    <div className="spy-setting-selects">
      <SpyfallSelect compact label="โหวต" value={value.votingMinutes} options={minutes} disabled={disabled} onChange={value => onChange('votingMinutes', value)}/>
      <SpyfallSelect compact label="สายลับตอบ" value={value.guessMinutes} options={minutes} disabled={disabled} onChange={value => onChange('guessMinutes', value)}/>
      <SpyfallSelect compact label="ผู้เล่น" value={value.playerCount} options={SPY_PLAYER_COUNTS.map(value => ({ value, label: `${value} คน`, disabled: value < currentPlayers }))} disabled={disabled} onChange={value => onChange('playerCount', value)}/>
    </div>
  </div>;
}
