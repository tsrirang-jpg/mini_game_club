import type { WhoCategory } from '../../../packages/shared/src/whoami.js';
interface Word { word: string; icon: string; category: Exclude<WhoCategory, 'mixed'>; aliases: string[] }
const group = (category: Word['category'], entries: [string, string, string?][]): Word[] => entries.map(([word,icon,aliases]) => ({ word,icon,category,aliases:[word,...(aliases?.split('|')??[])] }));
// Server-only: clients receive other people's assigned words, never the full pool
// or their own word. Each category has enough words for eight distinct identities.
export const WHO_WORDS: readonly Word[] = [
  ...group('animals', [
    ['แมว','🐱','cat'],['สุนัข','🐶','หมา|dog'],['ช้าง','🐘','elephant'],['สิงโต','🦁','lion'],
    ['เสือ','🐯','tiger'],['กระต่าย','🐰','rabbit'],['ลิง','🐵','monkey'],['แพนด้า','🐼','panda'],
    ['เพนกวิน','🐧','penguin'],['ปลาโลมา','🐬','โลมา|dolphin'],['ยีราฟ','🦒','giraffe'],['ม้าลาย','🦓','zebra'],
    ['จระเข้','🐊','crocodile'],['เต่า','🐢','turtle'],['นกฮูก','🦉','owl'],['ผีเสื้อ','🦋','butterfly'],
    ['ปลาฉลาม','🦈','ฉลาม|shark'],['กบ','🐸','frog'],['หมี','🐻','bear'],['ม้า','🐴','horse'],
    ['หมู','🐷','pig'],['วัว','🐮','cow'],['ไก่','🐔','chicken'],['เป็ด','🦆','duck'],
  ]),
  ...group('jobs', [
    ['นักบิน','👨‍✈️','pilot'],['เชฟ','👨‍🍳','พ่อครัว|แม่ครัว|chef'],['หมอ','👩‍⚕️','แพทย์|doctor'],['ครู','👩‍🏫','teacher'],
    ['ตำรวจ','👮','police'],['นักดับเพลิง','👨‍🚒','firefighter'],['นักร้อง','🎤','singer'],['นักแสดง','🎭','actor'],
    ['ชาวนา','👩‍🌾','farmer'],['นักฟุตบอล','⚽','footballer'],['นักบินอวกาศ','👩‍🚀','astronaut'],['นักวิทยาศาสตร์','👩‍🔬','scientist'],
    ['ช่างภาพ','📷','photographer'],['บุรุษไปรษณีย์','📮','พนักงานไปรษณีย์|postman'],['พยาบาล','🩺','nurse'],['ทันตแพทย์','🦷','หมอฟัน|dentist'],
    ['นักดนตรี','🎸','musician'],['ชาวประมง','🎣','fisherman'],['จิตรกร','🎨','นักวาดภาพ|painter'],['นักเขียน','✍️','writer'],
    ['นักมายากล','🎩','magician'],['สถาปนิก','📐','architect'],['นักข่าว','🎙️','reporter'],['ช่างตัดผม','💈','barber'],
  ]),
  ...group('objects', [
    ['โทรศัพท์','📱','มือถือ|โทรศัพท์มือถือ|phone'],['ร่ม','☂️','umbrella'],['นาฬิกา','⌚','watch|clock'],['กระจก','🪞','mirror'],
    ['จักรยาน','🚲','bicycle'],['รถยนต์','🚗','รถ|car'],['เครื่องบิน','✈️','airplane'],['เรือ','⛵','boat'],
    ['กีตาร์','🎸','guitar'],['เปียโน','🎹','piano'],['กล้องถ่ายรูป','📷','กล้อง|camera'],['โทรทัศน์','📺','ทีวี|tv|television'],
    ['ตู้เย็น','🧊','fridge'],['พัดลม','🌀','fan'],['หมอน','🛏️','pillow'],['เก้าอี้','🪑','chair'],
    ['รองเท้า','👟','shoe|shoes'],['แว่นตา','👓','glasses'],['กระเป๋า','🎒','bag'],['หนังสือ','📚','book'],
    ['ดินสอ','✏️','pencil'],['กรรไกร','✂️','scissors'],['กุญแจ','🔑','key'],['เทียน','🕯️','candle'],
  ]),
];
export const normalizeWhoWord = (value: string) => value.normalize('NFKC').toLocaleLowerCase('th-TH').replace(/[\s\p{P}\p{S}]/gu, '');
