export type GameKind = 'pok' | 'poker' | 'spyfall' | 'oldmaid' | 'whoami' | 'liar' | 'undercover' | 'roadfighter';
export type GameCategory = 'arcade' | 'cards' | 'party';
export interface GameMetadata { category: GameCategory; game: GameKind; name: string; caption: string; copy: string; players: string; path: string; action: string; tag: string; footer: string }
export const games: Record<GameKind, GameMetadata> = {
  roadfighter: {category:'arcade',game:'roadfighter',name:'Road Fighter',caption:'8-BIT ARCADE',copy:'หลบรถ เก็บน้ำมัน ไปให้ถึงเส้นชัย',players:'1 คน',path:'/road-fighter',action:'เลือก Road Fighter',tag:'อาร์เคด · คีย์บอร์ด / สัมผัส',footer:'ขับให้ถึงเส้นชัย · เล่นเพื่อความสนุก'},
  pok: {category:'cards',game:'pok',name:'ป๊อกเด้ง',caption:'QUICK & FUN',copy:'ไพ่สามใบ ลุ้นแต้ม สนุกได้ทุกวง',players:'2–10 คน',path:'/rooms/create',action:'เลือกป๊อกเด้ง',tag:'เพื่อนและบอท · แต้มจำลอง',footer:'เล่นเพื่อความสนุก · แต้มจำลอง ไม่มีมูลค่าเงินจริง'},
  poker: {category:'cards',game:'poker',name:'Poker',caption:'TEXAS HOLD’EM',copy:'ไพ่ห้าใบ วัดชั้นเชิง กลยุทธ์และความนิ่ง',players:'2–6 คน',path:'/poker/rooms/create',action:'เลือก Poker',tag:'เพื่อนและบอท · แต้มจำลอง',footer:'เล่นเพื่อความสนุก · แต้มจำลอง ไม่มีมูลค่าเงินจริง'},
  spyfall: {category:'party',game:'spyfall',name:'Spyfall',caption:'SECRET MISSION',copy:'หาใครคือสายลับ ด้วยคำถามและไหวพริบ',players:'3–8 คน',path:'/spyfall/rooms/create',action:'เลือก Spyfall',tag:'ถาม · จับพิรุธ · โหวต',footer:'เล่นเพื่อความสนุกกับเพื่อน · บทบาทลับเฉพาะคุณ'},
  oldmaid: {category:'cards',game:'oldmaid',name:'อีแก่กินน้ำ',caption:'OLD MAID',copy:'จับคู่ให้หมดมือ ใครเหลือไพ่ไร้คู่เป็นคนสุดท้าย',players:'3–8 คน',path:'/oldmaid/rooms/create',action:'เลือก Old Maid',tag:'จับคู่ · จั่วไพ่ · เล่นกับเพื่อน',footer:'จับคู่ให้หมดมือ · สนุกกับเพื่อนทั้งวง'},
  whoami: {category:'party',game:'whoami',name:'Who am I',caption:'ฉันคือใคร?',copy:'เพื่อนเห็นคำของคุณ ถามให้ตรงจุดแล้วทายตัวตน',players:'3–8 คน',path:'/whoami/rooms/create',action:'เลือก Who am I',tag:'ถาม · ตอบ · ทายตัวตน',footer:'เพื่อนเห็นคำของคุณ แต่คุณต้องทายเอง'},
  liar: {category:'cards',game:'liar',name:'ไพ่ตอแหล',caption:'LIAR’S CARD',copy:'ลงไพ่ให้เนียน จับโกหกให้ทัน ใครไพ่หมดก่อนชนะ',players:'2–6 คน',path:'/liar/rooms/create',action:'เลือก Liar’s Card',tag:'ลงไพ่ · ข้าม · จับโกหก',footer:'ไพ่ตอแหล · เล่นเพื่อความสนุกกับเพื่อน'},
  undercover: {category:'party',game:'undercover',name:'Undercover',caption:'COVERT WORDS',copy:'อธิบายคำให้เนียน หาคนที่ได้คำต่างจากคุณ',players:'3–8 คน',path:'/undercover/rooms/create',action:'เลือก Undercover',tag:'คำลับ · คำใบ้ · จับพิรุธ',footer:'คำลับเฉพาะคุณ · สนุกด้วยกันทั้งวง'},
};
export const gameOptions = Object.values(games);
