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
  return <details className="rules"><summary>กติกาประจำโต๊ะ</summary><p>ไพ่ 52 ใบ · A = 1 · 10/J/Q/K = 0 · คะแนนคือผลรวมหลักหน่วย</p><p>สองใบ 8/9 เป็นป๊อก ห้ามจั่ว และชนะมือไม่ป๊อก ถ้าเจ้ามือป๊อกเปิดทันที มิฉะนั้นผู้เล่นตัดสินใจก่อนเจ้ามือ จั่วได้ 1 ใบ หมดเวลา 20 วินาทีให้อยู่</p><p>คู่หรือสองใบดอกเดียวกัน = 2 เด้ง · สามใบดอกเดียวกัน = 3 เด้ง · ไม่คูณซ้อน ใช้เด้งของผู้ชนะ แต้มเท่ากันและสถานะป๊อกเหมือนกันเสมอ ไม่มีตอง เรียง หรือเซียน</p></details>;
}
