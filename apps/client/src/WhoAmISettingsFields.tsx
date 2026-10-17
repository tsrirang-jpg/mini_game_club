import { SpyfallSelect } from './SpyfallSelect';
import { WHO_CATEGORIES, WHO_GAME_ROUNDS, WHO_QUESTION_ROUNDS, WHO_TURN_MINUTES } from '../../../packages/shared/src/whoami';
import type { WhoSettings } from '../../../packages/shared/src/whoami';
const categories=WHO_CATEGORIES.map(option=>({...option}));
const minutes=WHO_TURN_MINUTES.map(value=>({value,label:`${value} นาที`}));
const questions=WHO_QUESTION_ROUNDS.map(value=>({value,label:`${value} รอบ`}));
const games=WHO_GAME_ROUNDS.map(value=>({value,label:`${value} รอบ`}));
export function WhoAmISettingsFields({value,disabled=false,onChange}:{value:WhoSettings;disabled?:boolean;onChange(value:WhoSettings):void}) {
  const change=(patch:Partial<WhoSettings>)=>onChange({category:value.category,turnMinutes:value.turnMinutes,questionRounds:value.questionRounds,gameRounds:value.gameRounds,...patch});
  return <div className="who-settings">
    <SpyfallSelect label="หมวดคำ" value={value.category} options={categories} disabled={disabled} onChange={category=>change({category})}/>
    <SpyfallSelect<number> label="เวลาต่อคน" value={value.turnMinutes} options={minutes} disabled={disabled} onChange={turnMinutes=>change({turnMinutes})}/>
    <SpyfallSelect<number> label="รอบการถาม" value={value.questionRounds} options={questions} disabled={disabled} onChange={questionRounds=>change({questionRounds})}/>
    <SpyfallSelect<number> label="รอบการเล่นเกม" value={value.gameRounds} options={games} disabled={disabled} onChange={gameRounds=>change({gameRounds})}/>
  </div>;
}
