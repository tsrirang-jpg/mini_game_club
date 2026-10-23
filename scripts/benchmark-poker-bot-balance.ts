import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';
import { analyzePokerBot, choosePokerBotAction } from '../apps/server/src/poker-bot';
import { pokerBotScenarios, seededStrategy } from '../tests/helpers/poker-bot-scenarios';
async function main(){
 const runs=Number(process.argv.find(arg=>arg.startsWith('--runs='))?.split('=')[1]??24);
 if(!Number.isInteger(runs)||runs<1||runs>256)throw Error('runs must be 1..256');
 const output=resolve(process.argv.find(arg=>arg.startsWith('--output='))?.slice(9)??'artifacts/previews/poker-bot-balance.json');
 const rows=[];
 for(const[name,view]of Object.entries(pokerBotScenarios())){
  const counts={fold:0,check:0,call:0,raise:0,allIn:0},started=performance.now();
  const a=await analyzePokerBot(view,{random:seededStrategy(912),iterations:128});
  for(let i=0;i<runs;i++){const decision=await choosePokerBotAction(view,{random:seededStrategy(700+i*317),iterations:96});counts[decision.type]++;}
  const row={name,runs,counts,continueRate:1-counts.fold/runs,equity:a.equity,potOdds:a.potOdds,continuationEquity:a.continuationEquity,projectedPot:a.projectedPot,expectedOpponents:a.expectedOpponents,milliseconds:Math.round(performance.now()-started)};rows.push(row);
  console.log(name+': '+JSON.stringify(counts)+' | continue '+Math.round(row.continueRate*100)+'%');
 }
 mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify({runs,iterations:96,rows},null,2)+'\n');
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;});
