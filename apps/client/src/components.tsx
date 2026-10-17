import type { Phase } from '../../../packages/shared/src/index';
export { Card } from './components/ui/Card';
export { Rules } from './components/entry/PokRules';
export const phaseLabel: Record<Phase, string> = { LOBBY: 'รอเพื่อนพร้อม', DEALING: 'กำลังแจกไพ่', PLAYER_ACTIONS: 'ผู้เล่นตัดสินใจ', DEALER_ACTION: 'เจ้ามือตัดสินใจ', REVEAL: 'เปิดไพ่', SETTLEMENT: 'สรุปแต้ม', ROUND_END: 'จบรอบ' };
