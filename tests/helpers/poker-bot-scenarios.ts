import type { Card, Suit } from '../../packages/shared/src/index';
import type { PokerBotView } from '../../apps/server/src/poker-bot';
import type { PokerPlayer } from '../../packages/shared/src/poker';
export const seededStrategy=(seed:number)=>(max:number)=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return Math.floor(seed/0x100000000*max);};
const c=(rank:number,suit:Suit):Card=>({rank,suit});
function preflop(hole:Card[],heroSeat:number,target:number,headsUp=false):PokerBotView {
 const players:PokerPlayer[]=Array.from({length:6},(_,seat)=>{
  const posted=seat===3?target:seat===1?10:seat===2?20:0;
  return {id:seat===heroSeat?'hero':seat===3?'raiser':'p'+seat,name:'Player '+seat,seat,isBot:seat!==3,points:1000-posted,
   connected:true,ready:false,folded:headsUp&&seat!==3&&seat!==heroSeat,allIn:false,inHand:true,
   streetBet:posted,contribution:posted,lastAction:seat===3?'Raise':'',reconnectUntil:0};
 });
 return {heroId:'hero',hole,history:[{id:'raiser',phase:'PREFLOP',type:'raise',paid:target,to:target,potBefore:30}],
  snapshot:{phase:'PREFLOP',roundId:1,buttonId:'p0',smallBlindId:heroSeat===1?'hero':'p1',bigBlindId:heroSeat===2?'hero':'p2',
   currentBet:target,minRaise:target-20,bigBlind:20,players,board:[],raiseAllowedIds:players.map(p=>p.id)}};
}
export function pokerBotScenarios():Record<string,PokerBotView> {
 const cheapPair=preflop([c(8,'hearts'),c(9,'spades')],2,60,true);
 cheapPair.snapshot.phase='FLOP';cheapPair.snapshot.board=[c(13,'clubs'),c(8,'clubs'),c(2,'diamonds')];
 cheapPair.snapshot.players.find(p=>p.id==='raiser')!.contribution=180;cheapPair.snapshot.players.find(p=>p.id==='raiser')!.streetBet=40;
 cheapPair.snapshot.players.find(p=>p.id==='hero')!.contribution=140;cheapPair.snapshot.players.find(p=>p.id==='hero')!.streetBet=0;
 cheapPair.snapshot.currentBet=40;cheapPair.snapshot.minRaise=40;cheapPair.history=[{id:'raiser',phase:'FLOP',type:'raise',paid:40,to:40,potBefore:300}];
 const draw=structuredClone(cheapPair);draw.hole=[c(8,'hearts'),c(9,'hearts')];draw.snapshot.board=[c(6,'hearts'),c(7,'hearts'),c(12,'spades')];
 const badRiver=structuredClone(cheapPair);badRiver.snapshot.phase='RIVER';badRiver.hole=[c(3,'clubs'),c(4,'spades')];
 badRiver.snapshot.board=[c(1,'hearts'),c(13,'hearts'),c(12,'hearts'),c(11,'hearts'),c(2,'diamonds')];
 badRiver.snapshot.players.find(p=>p.id==='raiser')!.streetBet=800;badRiver.snapshot.players.find(p=>p.id==='raiser')!.contribution=940;badRiver.snapshot.players.find(p=>p.id==='raiser')!.points=60;
 badRiver.snapshot.currentBet=800;badRiver.snapshot.minRaise=800;badRiver.history=[{id:'raiser',phase:'RIVER',type:'raise',paid:800,to:800,potBefore:300}];
 return {
  '98s-unacted-table-3bb':preflop([c(9,'hearts'),c(8,'hearts')],4,60),
  'T9s-unacted-table-3bb':preflop([c(10,'spades'),c(9,'spades')],4,60),
  'QJs-unacted-table-3bb':preflop([c(12,'diamonds'),c(11,'diamonds')],4,60),
  '98s-big-blind-3bb':preflop([c(9,'hearts'),c(8,'hearts')],2,60,true),
  '75s-big-blind-minraise':preflop([c(7,'spades'),c(5,'spades')],2,40,true),
  'JTo-big-blind-3bb':preflop([c(11,'hearts'),c(10,'clubs')],2,60,true),
  '72o-facing-25bb':preflop([c(7,'clubs'),c(2,'diamonds')],4,500),
  'middle-pair-small-flop-bet':cheapPair,
  'combo-draw-small-flop-bet':draw,
  'air-facing-river-overbet':badRiver,
 };
}
