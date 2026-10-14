import { navigate } from './router';
export function GameSelectPage() {
  return <main className="game-select"><span className="eyebrow">วงไพ่ · เล่นกับเพื่อนและบอท</span><h1>วันนี้เข้าวงไหน?</h1><p className="muted">เลือกเกม สร้างโต๊ะ แล้วชวนเพื่อนมาเล่น ใช้แต้มจำลอง</p><div className="game-options">
    <button className="game-option" onClick={() => navigate('/rooms/create')}><span className="game-symbol">♣</span><span className="eyebrow">QUICK & FUN</span><h2>ป๊อกเด้ง</h2><p>สองใบลุ้นป๊อก จั่วอีกใบ แล้วเปิดพร้อมกัน</p><strong>เลือกป๊อกเด้ง →</strong></button>
    <button className="game-option poker-option" onClick={() => navigate('/poker/rooms/create')}><span className="game-symbol">♠</span><span className="eyebrow">TEXAS HOLD’EM · NO-LIMIT</span><h2>Poker</h2><p>ไพ่สองใบ ไพ่กลางห้าใบ วางแผนทุกตา</p><strong>เลือก Poker →</strong></button>
    <button className="game-option spy-option" onClick={() => navigate('/spyfall/rooms/create')}><span className="game-symbol">◉</span><span className="eyebrow">SECRET MISSION · SOCIAL DEDUCTION</span><h2>Spyfall</h2><p>ถามให้เนียน จับพิรุธ แล้วค้นหาสายลับในห้อง</p><strong>เลือก Spyfall →</strong></button>
  </div></main>;
}
