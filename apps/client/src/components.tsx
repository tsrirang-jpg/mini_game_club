import type { Card as CardData, Phase } from '../../../packages/shared/src/index';
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
export const phaseLabel: Record<Phase, string> = { LOBBY: 'รอเพื่อนพร้อม', DEALING: 'กำลังแจกไพ่', PLAYER_ACTIONS: 'ผู้เล่นตัดสินใจ', DEALER_ACTION: 'เจ้ามือตัดสินใจ', REVEAL: 'เปิดไพ่', SETTLEMENT: 'สรุปแต้ม', ROUND_END: 'จบรอบ' };
export function Card({ card, index = 0 }: { card?: CardData; index?: number }) {
  const ranks: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rank = card ? (ranks[card.rank] ?? String(card.rank)) : '';
  return <div className={`card ${card ? (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : '') : 'back'}`} style={{ animationDelay: `${index * 90}ms` }} aria-label={card ? `${rank} ${card.suit}` : 'ไพ่คว่ำ'}>
    {card ? <><span>{rank}<small>{suits[card.suit]}</small></span><b>{suits[card.suit]}</b><span className="bottom">{rank}<small>{suits[card.suit]}</small></span></> : <b>♠</b>}
  </div>;
}
export function Rules() {
  const examples: { name: string; note: string; cards: CardData[] }[] = [
    { name: 'ป๊อก 9', note: 'สูงสุด · ชนะทุกประเภทอื่น', cards: [{ rank: 9, suit: 'clubs' }, { rank: 13, suit: 'hearts' }] },
    { name: 'ป๊อก 8', note: 'แพ้เฉพาะป๊อก 9', cards: [{ rank: 8, suit: 'clubs' }, { rank: 12, suit: 'hearts' }] },
    { name: 'ตอง ×5', note: 'สามใบเลขเดียวกัน', cards: [{ rank: 7, suit: 'clubs' }, { rank: 7, suit: 'hearts' }, { rank: 7, suit: 'spades' }] },
    { name: 'สามใบหน้า ×5', note: 'ทั้งสามใบเป็น J/Q/K (ซ้ำได้)', cards: [{ rank: 11, suit: 'clubs' }, { rank: 12, suit: 'hearts' }, { rank: 13, suit: 'spades' }] },
    { name: 'สามใบเรียง ×3', note: 'เลขต่อกัน · A-2-3 หรือ Q-K-A ได้', cards: [{ rank: 5, suit: 'clubs' }, { rank: 6, suit: 'hearts' }, { rank: 7, suit: 'spades' }] },
    { name: 'ดอกเดียวกัน ×3', note: 'ไพ่สองใบดอกเดียวกัน', cards: [{ rank: 2, suit: 'hearts' }, { rank: 5, suit: 'hearts' }] },
    { name: 'ไพ่คู่ ×2', note: 'ไพ่สองใบเลขเดียวกัน', cards: [{ rank: 7, suit: 'clubs' }, { rank: 7, suit: 'hearts' }] },
  ];
  return <details className="rules pok-rules"><summary>กติกาประจำโต๊ะ</summary><p>ไพ่ 52 ใบ · A = 1 · 10/J/Q/K = 0 · คะแนนคือผลรวมหลักหน่วย</p><p>เรียงจากสูงไปต่ำตามรายการด้านล่าง ไพ่พิเศษชนะมือธรรมดาทุกแต้ม และแพ้ป๊อก 8/9 ประเภทเดียวกันใช้แต้มตัดสิน แต้มเท่ากันเสมอ (ป๊อก 9 ชนป๊อก 9 ก็เสมอ)</p><div className="pok-rank-list">{examples.map(e => <section className="pok-rank" key={e.name}><div><strong>{e.name}</strong><small>{e.note}</small></div><div className="hand">{e.cards.map((card, i) => <Card key={i} card={card} index={i}/>)}</div></section>)}</div><p>สองใบ 8/9 เป็นป๊อกและอยู่ทันที ห้ามจั่ว ถ้าเจ้ามือป๊อกเปิดทันที มิฉะนั้นผู้เล่นตัดสินใจก่อนเจ้ามือ จั่วได้ 1 ใบ หมดเวลา 20 วินาทีให้อยู่</p><p>ไม่คูณซ้อน ใช้ตัวคูณสูงสุดของผู้ชนะ ป๊อกที่เป็นคู่หรือสองใบดอกเดียวกันยังได้ ×2 หรือ ×3 สามใบดอกเดียวกันเพียงอย่างเดียวไม่มีเด้ง และ K-A-2 ไม่ถือว่าเรียง แต้มจะจ่ายเมื่อเปิดไพ่สรุปรอบ</p></details>;
}
