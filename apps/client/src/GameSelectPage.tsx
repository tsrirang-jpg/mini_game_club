import { navigate } from './router';
import { GameArtwork } from './GameArtwork';
import type { GameKind } from './GameArtwork';
const games: {game:GameKind;name:string;caption:string;copy:string;players:string;path:string;action:string}[] = [
  {game:'pok',name:'ป๊อกเด้ง',caption:'QUICK & FUN',copy:'ไพ่สามใบ ลุ้นแต้ม สนุกได้ทุกวง',players:'2–6 คน',path:'/rooms/create',action:'เลือกป๊อกเด้ง →'},
  {game:'poker',name:'Poker',caption:'TEXAS HOLD’EM',copy:'ไพ่ห้าใบ วัดชั้นเชิง กลยุทธ์และความนิ่ง',players:'2–6 คน',path:'/poker/rooms/create',action:'เลือก Poker →'},
  {game:'spyfall',name:'Spyfall',caption:'SECRET MISSION',copy:'หาใครคือสายลับ ด้วยคำถามและไหวพริบ',players:'3–8 คน',path:'/spyfall/rooms/create',action:'เลือก Spyfall →'},
  {game:'oldmaid',name:'อีแก่กินน้ำ',caption:'OLD MAID',copy:'จับคู่ให้หมดมือ ใครเหลือไพ่ไร้คู่เป็นคนสุดท้าย',players:'3–8 คน',path:'/oldmaid/rooms/create',action:'เลือก Old Maid →'},
];
export function GameSelectPage() {
  return <main className="game-select"><span className="eyebrow">วงไพ่ · เล่นด้วยกัน สนุกทั้งวง</span><h1>วันนี้เข้าวงไหน?</h1><p className="muted">เลือกเกม สร้างห้อง แล้วชวนเพื่อนมาเข้าวง</p><div className="game-options">{games.map(g => <button key={g.game} className={`game-option theme-${g.game}`} aria-label={g.action} onClick={() => navigate(g.path)}><GameArtwork game={g.game}/><span className="eyebrow">{g.caption}</span><h2>{g.name}</h2><p>{g.copy}</p><div className="game-option-bottom"><span className="player-count-pill">{g.players}</span><strong>{g.action}</strong></div></button>)}</div></main>;
}
