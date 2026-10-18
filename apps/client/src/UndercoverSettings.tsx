import {SpyfallSelect} from './SpyfallSelect';
import {UNDER_MINUTES} from '../../../packages/shared/src/undercover';
import type {UnderSettings} from '../../../packages/shared/src/undercover';
const times=UNDER_MINUTES.map(value=>({value,label:`${value} นาที`}));
function Count({label,value,min,max,disabled,onChange}:{label:string;value:number;min:number;max:number;disabled:boolean;onChange(n:number):void}){
 return <div className="under-count"><span>{label}</span><button type="button" className="small" aria-label={`ลด ${label}`} disabled={disabled||value<=min} onClick={()=>onChange(value-1)}>−</button><strong>{value}</strong><button type="button" className="small" aria-label={`เพิ่ม ${label}`} disabled={disabled||value>=max} onClick={()=>onChange(value+1)}>＋</button></div>;
}
export function UndercoverSettings({value,disabled=false,onChange}:{value:UnderSettings;disabled?:boolean;onChange(s:UnderSettings):void}){
 const change=(patch:Partial<UnderSettings>)=>onChange({turnMinutes:value.turnMinutes,voteMinutes:value.voteMinutes,undercoverCount:value.undercoverCount,whiteCount:value.whiteCount,...patch});
 return <div className="under-settings"><SpyfallSelect<number> label="เวลาพิมพ์ในรอบตัวเอง" value={value.turnMinutes} options={times} disabled={disabled} onChange={turnMinutes=>change({turnMinutes})}/><SpyfallSelect<number> label="เวลาโหวต" value={value.voteMinutes} options={times} disabled={disabled} onChange={voteMinutes=>change({voteMinutes})}/><Count label="Undercover" min={1} max={2} value={value.undercoverCount} disabled={disabled} onChange={undercoverCount=>change({undercoverCount})}/><Count label="Mr. White" min={0} max={1} value={value.whiteCount} disabled={disabled} onChange={whiteCount=>change({whiteCount})}/><p className="fine">ผู้เล่น {Math.max(3,2*value.undercoverCount+value.whiteCount+1)}–8 คนสำหรับรูปแบบนี้</p></div>;
}
