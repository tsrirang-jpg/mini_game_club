import { Card } from './components';
import type { Card as CardData, Suit } from '../../../packages/shared/src/index';
const c = (rank: number, suit: Suit): CardData => ({ rank, suit });
const ranks = [
  { name: 'Royal flush', thai: 'รอยัลฟลัช', description: 'A K Q J 10 ดอกเดียวกัน เป็น Straight flush ที่สูงที่สุด', cards: [c(1,'spades'),c(13,'spades'),c(12,'spades'),c(11,'spades'),c(10,'spades')] },
  { name: 'Straight flush', thai: 'สเตรทฟลัช', description: 'ไพ่เรียงกัน 5 ใบและดอกเดียวกัน', cards: [c(9,'hearts'),c(8,'hearts'),c(7,'hearts'),c(6,'hearts'),c(5,'hearts')] },
  { name: 'Four of a kind', thai: 'โฟร์การ์ด / สี่ใบเหมือน', description: 'ไพ่แต้มเดียวกัน 4 ใบ และไพ่ประกอบ 1 ใบ', cards: [c(12,'spades'),c(12,'hearts'),c(12,'diamonds'),c(12,'clubs'),c(2,'spades')] },
  { name: 'Full house', thai: 'ฟูลเฮาส์', description: 'ไพ่สามใบแต้มเดียวกัน (ตอง) และอีกหนึ่งคู่', cards: [c(13,'spades'),c(13,'hearts'),c(13,'clubs'),c(7,'diamonds'),c(7,'clubs')] },
  { name: 'Flush', thai: 'ฟลัช', description: 'ไพ่ดอกเดียวกัน 5 ใบ โดยไม่จำเป็นต้องเรียง', cards: [c(1,'diamonds'),c(11,'diamonds'),c(8,'diamonds'),c(6,'diamonds'),c(3,'diamonds')] },
  { name: 'Straight', thai: 'สเตรท / ไพ่เรียง', description: 'ไพ่เรียงกัน 5 ใบ ดอกใดก็ได้ A ใช้สูงสุดหรือเป็น 1 ใน A 2 3 4 5', cards: [c(10,'spades'),c(9,'hearts'),c(8,'diamonds'),c(7,'clubs'),c(6,'spades')] },
  { name: 'Three of a kind', thai: 'ทรีออฟอะไคนด์ / ตอง', description: 'ไพ่แต้มเดียวกัน 3 ใบ และไพ่ประกอบ 2 ใบ', cards: [c(8,'spades'),c(8,'hearts'),c(8,'clubs'),c(13,'diamonds'),c(2,'clubs')] },
  { name: 'Two pair', thai: 'ทูแพร์ / สองคู่', description: 'ไพ่สองคู่ และไพ่ประกอบ 1 ใบ', cards: [c(11,'spades'),c(11,'hearts'),c(4,'clubs'),c(4,'diamonds'),c(1,'clubs')] },
  { name: 'One pair', thai: 'วันแพร์ / หนึ่งคู่', description: 'ไพ่หนึ่งคู่ และไพ่ประกอบ 3 ใบ', cards: [c(10,'spades'),c(10,'hearts'),c(1,'clubs'),c(8,'diamonds'),c(3,'clubs')] },
  { name: 'High card', thai: 'ไฮการ์ด / ไพ่สูง', description: 'ไม่มีชุดข้างต้น เปรียบเทียบไพ่สูงสุดก่อน', cards: [c(1,'spades'),c(13,'hearts'),c(9,'clubs'),c(6,'diamonds'),c(2,'clubs')] },
];
export function PokerRules() {
  return <details className="rules poker-rules"><summary>กติกา Poker และลำดับมือ</summary>
    <p>Texas Hold’em No-Limit สำรับ 52 ใบ ไม่มี Joker, blinds 10/20 หมุนปุ่ม D ทุกมือ Heads-up ปุ่ม D วาง SB และเล่นก่อน pre-flop</p>
    <p>Pre-flop → Flop 3 ใบ → Turn → River เลือก 5 ใบดีที่สุดจากไพ่ส่วนตัว 2 ใบและไพ่กลาง 5 ใบ ใช้ไพ่ส่วนตัว 0, 1 หรือ 2 ใบก็ได้</p>
    <h3>ลำดับมือ: แข็งที่สุด → อ่อนที่สุด</h3>
    <ol className="hand-rank-list" tabIndex={0} aria-label="ลำดับมือ Poker จากแข็งที่สุดถึงอ่อนที่สุด">{ranks.map(hand => <li key={hand.name} className="rank-example"><strong>{hand.name}<small>{hand.thai}</small></strong><div className="rank-cards" aria-label={`ตัวอย่าง ${hand.name}`}>{hand.cards.map((card,index) => <Card key={index} card={card}/>)}</div><p>{hand.description}</p></li>)}</ol>
    <p><b>ถ้าเป็นมือประเภทเดียวกัน:</b> เทียบแต้มชุดหลักก่อน แล้วเทียบไพ่ประกอบ (Kicker) จากสูงไปต่ำ Two pair เทียบคู่สูงก่อนคู่ต่ำ Full house เทียบตองก่อนคู่ Straight เทียบใบสูงสุด โดย A 2 3 4 5 นับสูงสุดเป็น 5 ดอกไพ่ไม่ตัดสินผู้ชนะ</p>
    <p>ถ้า 5 ใบที่ดีที่สุดเท่ากัน แบ่ง pot เท่ากัน แม้ไพ่ที่เหลือในมือจะแตกต่างกัน Royal flush เป็นรูปแบบสูงสุดของ Straight flush</p>
    <h3>การเดิมพันและชิป Raise</h3>
    <p>Raise ต้องเพิ่มจากยอดเดิมพันโต๊ะอย่างน้อยเท่ากับ full raise ล่าสุด เริ่มต้นขั้นต่ำ 20 ชิป เช่น โต๊ะวาง 20 แล้วเลือกชิป 50 จะ Raise รวมเป็น 70 ถ้าคุณวางไว้ 10 ต้องจ่ายเพิ่ม 60 (Call 10 + Raise 50)</p>
    <p>ปุ่มชิป 10, 20, 50, 100, 200 คือขนาดที่เพิ่มจากยอดเดิมพันโต๊ะ ปุ่มที่ต่ำกว่าขั้นต่ำหรือเกินชิปของคุณจะกดไม่ได้ ยกเว้น All-in ใช้ชิปที่เหลือทั้งหมด Short all-in ไม่เปิดสิทธิ์ Raise ซ้ำให้คนที่เล่นไปแล้วจนยอดเพิ่มครบขั้นต่ำ</p>
    <p>แยก side pot ตามชิปที่แต่ละคนลง ผู้ที่ Fold ไม่มีสิทธิ์ชนะ pot คืนส่วนที่ไม่มีคนรับเดิมพัน มือเสมอแบ่ง pot โดยชิปเศษให้ผู้ชนะตามลำดับจากซ้ายของ D</p>
    <p>บอทใช้ไพ่ของตัวเองและข้อมูลที่เปิดเผยบนโต๊ะ สามารถ Fold, Call, Raise, Bluff และ All-in ได้ตามสถานการณ์</p>
    <p>มีเวลาตัดสินใจ <b>30 วินาทีต่อคน</b> หมดเวลา Check ถ้าไม่มีค่า Call มิฉะนั้น Fold</p>
  </details>;
}
