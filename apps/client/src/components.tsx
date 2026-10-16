import type { Card as CardData, Phase } from '../../../packages/shared/src/index';
import { CourtArt } from './CourtArt';
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
export const phaseLabel: Record<Phase, string> = { LOBBY: 'รอเพื่อนพร้อม', DEALING: 'กำลังแจกไพ่', PLAYER_ACTIONS: 'ผู้เล่นตัดสินใจ', DEALER_ACTION: 'เจ้ามือตัดสินใจ', REVEAL: 'เปิดไพ่', SETTLEMENT: 'สรุปแต้ม', ROUND_END: 'จบรอบ' };
export function Card({ card, index = 0 }: { card?: CardData; index?: number }) {
  const ranks: Record<number, string> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const rank = card ? (ranks[card.rank] ?? String(card.rank)) : '';
  return <div className={`card ${card ? (card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : '') : 'back'}`} style={{ animationDelay: `${index * 90}ms` }} aria-label={card ? `${rank} ${card.suit}` : 'ไพ่คว่ำ'}>
    {card ? <><span>{rank}<small>{suits[card.suit]}</small></span><b>{suits[card.suit]}</b>{card.rank >= 11 && <CourtArt rank={card.rank}/>}<span className="bottom">{rank}<small>{suits[card.suit]}</small></span></> : <b>♠</b>}
  </div>;
}
export function Rules() {
  return <details className="rules"><summary>กติกาประจำโต๊ะ</summary><p>ไพ่ 52 ใบ · A = 1 · 10/J/Q/K = 0 · แต้มปกติคือผลรวมหลักหน่วย</p><p>ผู้เล่นได้สองใบ 8/9 เป็นป๊อก เปิดไพ่ทันทีและห้ามจั่ว ถ้าเจ้ามือป๊อกเปิดสรุปทันที มิฉะนั้นผู้เล่นตัดสินใจก่อนเจ้ามือ จั่วได้ 1 ใบ หมดเวลา 30 วินาทีให้อยู่</p><p>อันดับจากต่ำไปสูง: แต้มปกติ → สามเหลือง → เรียง → เรียงฟลัช → ตอง → ป๊อก มือพิเศษสามใบชนิดเดียวกันเทียบไพ่สูงสุด โดย A สูงสุด ถ้าไพ่สูงสุดเท่ากันถือว่าเสมอ ป๊อก 9 ชนะป๊อก 8 และป๊อกแต้มเท่ากันเสมอ เจ้ามือจั่วแล้วได้ 8/9 แต้มปกติ มีอันดับเทียบเท่าป๊อกและชนะมือพิเศษสามใบ ให้เทียบแต้มกับป๊อกสองใบ: 8 เสมอป๊อก 8 แต่แพ้ป๊อก 9 และ 9 เสมอป๊อก 9</p><p>คู่หรือสองใบดอกเดียวกัน = 2 เด้ง · สามใบดอกเดียวกัน = 3 เด้ง · สามเหลือง (ทั้งสามใบอยู่ใน J/Q/K) และเรียง = 3 เด้ง · เรียงฟลัชและตอง = 5 เด้ง ไม่คูณซ้อน ใช้เด้งของฝ่ายที่ชนะ</p><p>เรียงใช้ 2 ต่ำสุด และ A สูงสุด เช่น 2-3-4, 5-6-7, Q-K-A ไม่รับ A-2-3 หรือ K-A-2 เรียงฟลัชคือเรียงและดอกเดียวกันทั้งสามใบ</p><p>ก่อนจั่ว เจ้ามือเลือก “จับ” ผู้เล่นที่มีไพ่ 3 ใบได้ ใช้ไพ่เจ้ามือ 2 ใบสู้ จากนั้นจับคนอื่น จั่ว หรืออยู่เพื่อสู้กับคนที่เหลือ จับสำเร็จแล้วเริ่มนับเวลาเจ้ามือใหม่ 30 วินาที หากเจ้ามือจั่วแล้วได้ 8/9 แต้มปกติ จะเทียบผู้ถูกจับใหม่ด้วยไพ่เจ้ามือ 3 ใบ ถ้าเป็นมืออื่นยังใช้ผลจับเดิม ชำระแต้มพร้อมกันเมื่อจบรอบ</p></details>;
}
