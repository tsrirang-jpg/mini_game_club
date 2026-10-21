# Poker desktop: ตำแหน่งกองเดิมพัน 3 แบบ

ภาพตัวอย่างสร้างด้วย built-in imagegen โดยอ้างอิงภาพหน้าจอจริง `artifacts/previews/preview-poker-pots-1903x885.png` ยังไม่ได้ปรับโค้ด UI

## ข้อกำหนดร่วม / Prompt set

Use case: ui-mockup. Flat full-screen desktop Poker screenshot. Preserve the current midnight navy / deep blue / cyan / indigo theme and gold วงเซียน logo. Five equal fixed-size opponent panels across the top; fixed-size own panel on the lower left and existing action console on the lower right. Enlarge only the five centred community cards by approximately 18%, with 3px corners and one rank/suit on each card. Reserve pot information space independently so pot count never changes player-panel dimensions. Dim zero-stack opponents. Keep every control visible within the desktop viewport. Show Main Pot 5,160; Side Pots 200/160/120/40; refunded chips 320 to Poker 1. Contested total 5,680 excludes refunded 320.

1. **CENTER POT STRIP** — Reserve a fixed-height horizontal band below the opponent row and above the board. Put main/side pot cells together and separate the amber refund cell. Offer details instead of multiline eligible-player lists.
2. **SIDE LEDGER** — Put a fixed-width pot ledger to the right below the opponent row. Reserve matching quiet space on the left so the community board stays centred on the whole table. If needed, scroll extra items inside the ledger rather than expanding other regions.
3. **BOTTOM POT RAIL** — Reserve a slim horizontal rail below the board/street track and above the action console. Use compact aligned labels, separate the refund section, and keep the upper table clear.

## หลักการเมื่อนำไปเขียนโค้ด

- กันพื้นที่กองเดิมพันไว้ตั้งแต่มี Main Pot กองเดียว ไม่เพิ่มแถว grid ภายหลัง
- ขนาดกรอบผู้เล่นคงที่ภายใน breakpoint เดียวกัน ไม่ผูกกับจำนวนกองหรือสถานะการแจกไพ่
- หากกองมากเกินพื้นที่ ใช้ปุ่ม +N / รายละเอียด หรือเลื่อนภายในแผง ไม่เพิ่มความสูงทั้งโต๊ะ
- ตัวเลขและข้อความในภาพเป็น mockup; การนำไปใช้จริงต้องใช้ยอดและสิทธิ์รับชิปจาก server
- ปรับขนาดไพ่กลางตามทั้งความกว้างและความสูง viewport เพื่อให้จอ desktop เตี้ยยังเห็นปุ่มครบ

## ไฟล์

- `01-center-pot-strip.png`
- `02-side-ledger.png`
- `03-bottom-pot-rail.png`
