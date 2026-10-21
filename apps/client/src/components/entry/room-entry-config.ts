import type {GameKind} from '../../games';
import type {IconName} from '../../roadfighter/RoadIcon';

export type RoomGame = Exclude<GameKind, 'roadfighter'>;
type Fact = readonly [IconName, string, string];
type Step = readonly [IconName, string];
interface EntryConfig {
  subtitle?: string;
  caption: string;
  botLimit?: 6 | 8 | 10;
  defaultBots?: number;
  facts: readonly Fact[];
  steps: readonly Step[];
}
export const roomEntries = {
  pok: {
    caption: 'ชวนเพื่อนมาเข้าวง ลุ้นแต้มไปด้วยกัน',
    botLimit: 10, defaultBots: 0,
    facts: [['cup', 'เริ่มต้น', '1,000 แต้ม'], ['cards', 'เล่นเพื่อสนุก', 'แต้มจำลอง']],
    steps: [['cards', 'รับไพ่'], ['user', 'เลือกจั่วหรืออยู่'], ['cup', 'เทียบแต้มกับเจ้ามือ']],
  },
  poker: {
    caption: 'อ่านเกมให้ขาด แล้วเลือกตาของคุณ',
    botLimit: 6, defaultBots: 1,
    facts: [['cards', 'Blinds', '10/20'], ['cup', 'เริ่มต้น', '1,000 ชิป']],
    steps: [['cards', 'รับไพ่ 2 ใบ'], ['user', 'Fold / Call / Raise'], ['cards', 'รวมกับไพ่กลาง 5 ใบ']],
  },
  spyfall: {
    caption: 'หนึ่งคนมีความลับ ทั้งห้องมีคำถาม',
    facts: [['help', 'บทบาทลับ', 'สายลับ 1 คน'], ['party', 'คุยกับเพื่อน', 'แชตในเกม']],
    steps: [['user', 'ถามตอบ'], ['help', 'จับพิรุธ'], ['cup', 'โหวตหาสายลับ']],
  },
  oldmaid: {
    subtitle: 'OLD MAID', caption: 'จับคู่ให้หมดมือ ใครจะเหลือใบสุดท้าย?',
    botLimit: 8, defaultBots: 2,
    facts: [['cards', 'ผลัดกันจั่ว', 'ทีละ 1 ใบ'], ['cards', 'จับคู่แล้ว', 'ทิ้งอัตโนมัติ']],
    steps: [['cards', 'จั่วจากเพื่อน'], ['cards', 'จับคู่ไพ่'], ['help', 'ระวังใบสุดท้าย']],
  },
  whoami: {
    subtitle: 'ฉันคือใคร?', caption: 'เพื่อนเห็นคำของคุณ แต่คุณต้องทายเอง',
    facts: [['help', 'เพื่อนเห็นคำ', 'คุณต้องทายเอง']],
    steps: [['help', 'ถามให้ตรงจุด'], ['user', 'ฟังคำตอบ'], ['cup', 'ทายตัวตนของคุณ']],
  },
  liar: {
    subtitle: 'LIAR’S CARD', caption: 'วางไพ่ให้เนียน จับโกหกให้ทัน',
    botLimit: 6, defaultBots: 0,
    facts: [['clock', 'จับโกหกภายใน', '5 วินาที']],
    steps: [['cards', 'ลงไพ่ให้เนียน'], ['help', 'เชื่อหรือจับโกหก'], ['cup', 'ไพ่หมดก่อนชนะ']],
  },
  undercover: {
    caption: 'อธิบายคำให้เนียน หาคนที่ได้คำต่างจากคุณ',
    facts: [['help', 'คำเฉพาะคุณ', 'บทบาทลับ']],
    steps: [['user', 'อธิบายคำ'], ['help', 'ฟังและจับพิรุธ'], ['cup', 'โหวตหาคนคำต่าง']],
  },
} satisfies Record<RoomGame, EntryConfig>;
export function entryConfig(game: RoomGame): EntryConfig { return roomEntries[game]; }
