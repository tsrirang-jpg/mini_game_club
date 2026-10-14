# วงไพ่ — Browser Multiplayer Card Games

เล่นออนไลน์: [วงไพ่](https://wong-pai.onrender.com/games) · [GitHub](https://github.com/tsrirang-jpg/mini_game_club)

ป๊อกเด้งและ Poker Texas Hold’em No-Limit สำหรับเล่นกับเพื่อนหรือบอทรวม 2–6 คน ใช้แต้มจำลอง และ Spyfall สำหรับผู้เล่นจริง 3–8 คน พร้อมบทบาทลับและแชต

## Spyfall: ภารกิจจับสายลับ

หน้าเลือกเกม `/games` มีเกม Spyfall เป็นเกมที่สาม

- สร้างห้อง: `/spyfall/rooms/create`
- เข้าห้อง: `/spyfall/rooms/join`
- เล่น: `/spyfall/play/<ROOM_CODE>`

เวอร์ชันนี้ใช้เงื่อนไขชนะที่กำหนดสำหรับวงไพ่ ไม่ใช่กติกาต้นฉบับทุกข้อ:

1. ผู้เล่นจริง 3–8 คน ทุกคนกดพร้อมแล้ว host เริ่มเกม Server สุ่มสายลับหนึ่งคนและสถานที่เดียวกันให้คนทั่วไป พร้อมอาชีพที่แตกต่างกัน สายลับไม่ได้รับสถานที่
2. ตั้งเวลาถามตอบได้ 5 หรือ 10 นาที คุยผ่านแชตในเกม ทุกคนรวมสายลับกดพร้อมโหวตเพื่อเริ่มโหวตก่อนเวลาได้ หมดเวลาถามเริ่มโหวตอัตโนมัติ
3. ช่วงโหวต 3 นาที เลือกผู้เล่นคนอื่นแล้วกดยืนยัน ไม่มี self-vote แต่ละคนเปลี่ยนเสียงได้ก่อนทุกคนส่งครบ เมื่อส่งครบหรือตัวจับเวลาหมดจะล็อกผล เสียงยังเป็นความลับระหว่างลงคะแนน
4. ใช้เสียงเกินครึ่งของผู้เล่นในรอบเป็นเกณฑ์จับ ถ้าเสมอ/ไม่มีเสียงเกินครึ่ง/จับผิดคน สายลับชนะ คนไม่ลงคะแนนเมื่อหมดเวลาถือว่างดออกเสียง
5. ถ้าจับถูก สายลับพิมพ์สถานที่ได้หนึ่งครั้งภายใน 60 วินาที ตอบถูกสายลับชนะ ตอบผิดหรือหมดเวลาคนทั่วไปชนะ แชตหยุดรับข้อความในช่วงนี้เพื่อไม่เปิดเผยคำตอบ
6. เมื่อจบจึงเปิดสถานที่ สายลับ และผลโหวต ผู้ชนะได้คนละ 1 คะแนนสะสม Host เตรียมภารกิจใหม่ได้ ไม่มีรอบใหม่อัตโนมัติ

บทบาทส่งเฉพาะเจ้าของด้วย private WebSocket message ไม่อยู่ใน public snapshot หรือ browser catalogue ไพ่เกมอื่นใช้ private-hand logic เดิม ส่วน Spyfall ใช้ secret-role session แยกกัน Refresh/reconnect ภายใน 60 วินาทีได้บทบาทและเสียงโหวตเดิม หากหลุดถาวรในรอบจะคงที่นั่งไว้จนจบ รอบยังเดินด้วย timer และผู้ที่ไม่ตอบ/ไม่โหวตใช้กติกาหมดเวลาข้างต้น

แชตเป็น plain text ความยาว 1–500 ตัวอักษร จำกัด 3 ข้อความต่อ 5 วินาทีต่อผู้เล่น เก็บล่าสุด 100 ข้อความ เริ่มรอบใหม่จะล้างแชตรอบเก่า ไม่มี HTML execution ไม่มี voice chat หรือบอทใน Spyfall

Server เทียบคำตอบด้วยชื่อสถานที่และ aliases ที่กำหนด รองรับช่องว่าง punctuation และตัวพิมพ์ใหญ่/เล็ก ใช้ exact normalized match ไม่ใช้ substring หรือ fuzzy matching รูปแบบนี้ช่วยไม่ให้พิมพ์หลายสถานที่ในคำตอบเดียวแล้วถือว่าถูก

Code: `packages/shared/src/spyfall.ts`, `apps/server/src/spyfall-game.ts`, `spyfall-room.ts`, `spyfall-locations.ts`, และ `apps/client/src/SpyfallCreatePage.tsx`, `SpyfallPlayPage.tsx`, `spyfall.css` สถานที่และ aliases อยู่ใน server เท่านั้น

ทดสอบ 3 browser sessions ด้วย `npm.cmd run test:spyfall` ขณะ `npm.cmd run dev` เปิดอยู่

## เลือกเกมและเล่น Poker

หน้าแรก `/games` ให้เลือกป๊อกเด้งหรือ Poker หน้าสร้างห้องและหน้าเล่นแยกกันสำหรับแต่ละเกม

- Poker สร้างห้อง: `/poker/rooms/create`
- Poker เข้าห้อง: `/poker/rooms/join`
- Poker โต๊ะเล่น: `/poker/play/<ROOM_CODE>`

Poker ใช้ Texas Hold’em No-Limit: ไพ่ส่วนตัวคนละ 2 ใบ, ไพ่กลาง Flop 3 ใบ → Turn 1 ใบ → River 1 ใบ เลือกมือ 5 ใบดีที่สุดจาก 7 ใบ (ใช้ hole cards 0–2 ใบก็ได้) มี Small blind 10 และ Big blind 20 ปุ่ม dealer หมุนไปที่นั่งถัดไปที่มีชิปในแต่ละมือ Heads-up ปุ่ม dealer เป็น SB เล่นก่อน pre-flop และเล่นหลัง BB ใน street ถัดไป

เดิมพันตามลำดับตาด้วย Fold/Check/Call/Raise/All-in ช่อง Raise คือยอดรวมเดิมพันของตัวเองใน street นี้ ไม่ใช่ชิปเพิ่มจากยอดเดิม Minimum raise เท่ากับ full raise ล่าสุด Short all-in ไม่เปิดสิทธิ์ raise ใหม่ให้ผู้ที่เล่นไปแล้วจนยอดเพิ่มสะสมครบขั้นต่ำ แต่ยังต้อง Call ส่วนต่างหรือ Fold

ปุ่มชิป 10/20/50/100/200 เลือกขนาด Raise ที่เพิ่มจากยอดเดิมพันโต๊ะ เช่น ยอดโต๊ะ 20 เลือก 50 = Raise รวม 70 หากวางไว้ 10 ต้องจ่ายเพิ่ม 60 ปุ่มต่ำกว่าขั้นต่ำหรือเกินชิปที่มีจะปิด ใช้ All-in สำหรับชิปที่เหลือทั้งหมด รวมถึง short all-in ที่กติกาอนุญาต ยังใส่ยอดรวมอื่นในช่อง Raise ได้ตาม No-Limit และต้องกดยืนยันก่อนส่งเดิมพัน

กติกา Poker ทั้งหน้าสร้างห้องและหน้าเล่นมีลำดับมือจาก Royal flush ถึง High card พร้อมรูปไพ่ตัวอย่างครบ 10 ลำดับ ชื่อไทย/อังกฤษ และวิธีเทียบแต้มชุดหลักกับ kicker

Server แยก main pot/side pots ตาม contribution ผู้เล่นที่ fold ไม่ชนะ pot คืนส่วนที่ไม่มีผู้เล่นรับเดิมพัน มือเสมอแบ่ง pot และให้ชิปเศษตามลำดับผู้ชนะจากซ้ายของปุ่ม dealer ดอกไพ่ไม่ใช้ตัดสินเสมอ ไม่มี rake

บนโต๊ะแสดงยอดรวม POT พร้อมช่อง Main Pot, Side Pot แต่ละกอง และคืนชิปส่วนที่ไม่มีคนรับ แสดงผู้มีสิทธิ์ตามหมายเลขที่นั่งระหว่างเล่น และผู้ที่ได้รับชิปพร้อมยอดจริงจากแต่ละกองหลังจบ กดที่กองใดก็เปิดรายละเอียดชื่อผู้เล่น สิทธิ์ และส่วนแบ่งทั้งหมดได้ ข้อมูลระหว่างเล่นเปลี่ยนตามการตอบรับเดิมพัน ไม่มีการเปิดผู้ชนะก่อนจบรอบหรือประกาศคืนชิปก่อนชำระผล

ตัวอย่างลงชิป 420/420/160/420 รวม 1,420: Main Pot 640 ชิปชิงได้ทั้ง 4 คน ส่วน Side Pot 780 เฉพาะสามคนที่ลงถึง 420 คน All-in 160 ไม่ได้สิทธิ์ใน Side Pot ชื่อและยอดของผู้เล่นที่ออกหลังจบรอบยังอยู่ในสรุป ไม่ทำให้ยอดรวมกองเงินลดลง

Poker มีเวลาตัดสินใจ 30 วินาทีต่อคน Server ส่ง deadline และระยะเวลาให้ UI ใช้กับแถบนับถอยหลัง หมดเวลาให้ Check เมื่อไม่ต้องจ่ายเพิ่ม มิฉะนั้น Fold ผู้เล่นที่ reconnect จะได้ไพ่เดิม ผู้ที่ all-in แล้วหลุดยังมีสิทธิ์ใน pot; ผู้เล่นที่หลุดถาวรจะลบหลังจบรอบ บอทใช้เฉพาะไพ่ตัวเอง ไพ่กลาง และราคาเดิมพันที่เป็นข้อมูลสาธารณะ เป็นบอทพื้นฐานแบบ conservative ไม่ใช่ AI ระดับแข่งขัน

UI มี animation แจก hole cards, flip เปิดไพ่กลาง, สถานะผู้เล่นที่ถึงตา, timer และสรุป pot รองรับ reduced-motion โดยปิด animation ตามการตั้งค่า browser

หน้าเล่น Poker ใช้พื้นที่จอจริงด้วย `100dvh` รองรับแนวตั้งและแนวนอน โต๊ะ ผู้เล่น 6 คน ไพ่กลาง ไพ่ตัวเอง ตัวจับเวลา และแผง Fold/Check/Call/Raise/All-in อยู่ในจอเดียว ปุ่มชิปกับยืนยัน Raise อยู่ที่แผงด้านล่าง ไม่ต้อง scroll หน้าเพื่อเดิมพัน จอแนวนอนที่เตี้ยจัดคู่แข่งเป็นแถวเดียว ส่วนจอสูงจัดที่นั่งรอบไพ่กลาง

จำกัดความกว้างหน้าโต๊ะที่ 1,280 px และวางกลางจอ บน desktop กองเดิมพันอยู่ข้างยอด POT และไพ่กลาง ส่วนมือถือใช้ช่องว่างในแถวที่นั่งเพื่อให้กองเงินกับปุ่มเดิมพันยังอยู่ในจอเดียว หมายเลข `#1`–`#6` ใช้อ้างอิงที่นั่งในช่องกองเงิน กดกองเงินเพื่ออ่านชื่อและส่วนแบ่งเต็ม

ปุ่มกติกาและจัดการโต๊ะเปิด dialog บนหน้าเล่น กดปิดหรือ Escape กลับมาเล่นได้ทันที Host เพิ่มบอทจากแผงล่างและนำบอทออก/รีเซ็ตแต้มใน dialog จัดการโต๊ะ ผลแต่ละคนแสดงที่ที่นั่งและเปิดดูสรุป Pot เต็มได้เมื่อจบรอบ เนื้อหากติกายาวเลื่อนภายใน dialog ได้

การเริ่มรอบถัดไปยังเป็นแบบ manual: host กดเตรียมรอบใหม่ ผู้เล่นกดพร้อม และเริ่มรอบ ผู้เล่นชิปหมดพักมือจน host รีเซ็ตแต้มใน lobby ไม่มี tournament, blind escalation, rebuy ระหว่างมือ หรือเงินจริง

อ้างอิงกติกา: [PokerStars Texas Hold’em](https://www.pokerstars.com/poker/games/texas-holdem/) และ [Poker terms and rules](https://www.pokerstars.com/help/articles/poker-rules-master/229168/)

เพิ่ม code ที่ `packages/shared/src/poker.ts` (hand evaluator/pots), `apps/server/src/poker-game.ts`, `poker-room.ts`, และ `apps/client/src/PokerCreatePage.tsx`, `PokerPlayPage.tsx` ใช้ GameSession generic ร่วมกับป๊อกเด้ง แยก reconnect token ของแต่ละเกม

ทดสอบ browser Poker ขณะ `npm run dev` เปิดอยู่: `node tests/poker-browser.mjs`

ตรวจ responsive โต๊ะเต็ม 6 คนด้วย `npm run test:poker-layout`: 11 ขนาดจอ 320×568, 360×640, 390×844, 568×320, 667×375, 740×360, 844×390, 932×430, 768×1024, 1024×600 และ 1366×768 ตรวจช่วง lobby, เลือกชิป Raise และจบรอบ ว่าไม่มี page scroll, ไม่มีส่วนควบคุมถูกตัด และไม่มีที่นั่งหรือไพ่กลางซ้อนกัน ใช้ `GAME_URL` เปลี่ยน URL ไปตรวจ production ได้

`npm run test:poker-pots` ใช้ browser 6 sessions เล่นจริงจนชิปไม่เท่ากันแล้ว All-in สร้าง Main Pot + 4 Side Pots + ส่วนคืนชิป ตรวจสิทธิ์ ยอดกอง ส่วนแบ่งเทียบชิปที่ได้รับจริง และ responsive 13 ขนาดจอ รวม desktop 1903×885 และ 2560×1080

## ป๊อกเด้ง: เล่นกับบอทและหน้าแยก

- `/rooms/create`: สร้างห้อง เลือกบอท 0–5 ตัว (0 คือเล่นกับเพื่อน)
- `/rooms/join`: เข้าห้องเพื่อนด้วยรหัส
- `/play/<ROOM_CODE>`: โต๊ะเล่น แสดงเฉพาะเกม ไม่มีฟอร์มสร้างห้อง

สร้างห้องพร้อมบอทอย่างน้อยหนึ่งตัวเพื่อเล่นคนเดียวได้ บอทตัวแรกเป็นเจ้ามือเริ่มต้น เปลี่ยนเจ้ามือใน lobby ได้ Host เพิ่ม/นำบอทออกได้ก่อนเริ่มรอบ จำนวนคนกับบอทรวมไม่เกิน 6 ที่นั่ง บอทกดพร้อมอัตโนมัติทุกครั้ง

บอททำงานบน server และใช้เฉพาะไพ่ตัวเองในการตัดสินใจ คะแนน 0–4 จั่ว, 5–9 อยู่, ป๊อกไม่จั่ว บอทมีจังหวะคิดสั้น ๆ ก่อนเล่น ไม่เข้าถึงไพ่ผู้เล่นอื่นหรือไพ่ที่จะจั่ว และไม่สามารถรับ role host ได้ ใช้แต้มและกติกาชำระผลเดียวกับผู้เล่น

Refresh หน้าเล่นจะ reconnect กลับโต๊ะเดิม การกด Back ไปหน้าสร้างห้องยังไม่ออกจากห้อง และมีปุ่มกลับไปเล่น กดออกจากห้องเพื่อจบ session ถ้าเปิด URL หน้าเล่นโดยไม่มี session จะแสดงปุ่มไปหน้าเข้าห้องพร้อมรหัสนั้น

## เริ่มใช้งาน

ต้องมี Node.js 22.12+ หรือ Node.js 24 LTS และ npm

```powershell
npm.cmd install
npm.cmd run dev
```

เปิด http://127.0.0.1:5188 ใน browser สร้างห้องและคัดลอกรหัส จากนั้นเปิดอีก browser/profile/incognito เพื่อเข้าร่วมด้วยรหัสเดียวกัน ผู้เล่นอื่นกดพร้อม แล้ว host เริ่มรอบได้

sessionStorage แยก session ต่อแท็บและรักษา reconnect เมื่อ refresh หาก browser คัดลอก sessionStorage ตอน duplicate tab ให้ใช้แท็บใหม่ที่เปิด URL เองหรือ incognito เพื่อแยกผู้เล่น

เล่นผ่านมือถือใน Wi-Fi เดียวกันได้ที่ `http://<LAN-IP ของเครื่อง server>:5188` โดยต้องอนุญาต port 5188 ผ่าน firewall ของเครื่อง การเล่นจริงบนอินเทอร์เน็ตควรใช้ HTTPS/WSS

## คำสั่ง

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
npm.cmd run start -w @pok/server
```

`npm run dev` เปิด Vite 5188 และ game server 2567 พร้อมกัน Vite proxy `/game` ไป game server จึงใช้ได้ทั้ง localhost และ LAN โดยไม่ hardcode localhost ลง client ใช้ strictPort เพื่อแจ้งชัดเจนเมื่อพอร์ตถูกใช้อยู่

`test:browser` ต้องเปิด `npm run dev` ในอีก terminal ก่อน ใช้ Microsoft Edge ที่ติดตั้งอยู่ผ่าน Playwright และตรวจ desktop/mobile สอง session

`.env.example` เป็นตัวอย่างค่าตั้ง ไม่ต้องสร้าง `.env` สำหรับ local defaults ถ้าเปลี่ยน URL client ให้ใส่ `VITE_GAME_URL=wss://...` ใน `apps/client/.env.local` ก่อน build ฝั่ง server รับ `PORT` จาก environment ของ process เช่น `$env:PORT='2567'` ใน PowerShell (ไม่ได้อ่าน root .env อัตโนมัติ)

## โครงสร้าง

- `apps/client`: React UI, CSS cards, guest lobby, table, client session/reconnect
- `apps/server`: Colyseus transport/room, framework-independent Game state machine
- `packages/shared`: types, hand evaluation, shuffle, comparison, balanced/idempotent ledger
- `tests`: rule tests, state-machine tests, real WebSocket integration tests

ใช้ Colyseus 0.18 ทั้ง server และ SDK ให้เข้ากัน ใช้ explicit public snapshot messages แทน Schema replication สำหรับเกมผลัดจังหวะนี้ ไพ่ลับอยู่ใน Game instance ส่ง `hand` เฉพาะเจ้าของมือ สำรับไม่อยู่ใน public state ไม่มี client API สำหรับกำหนดคะแนน ไพ่ หรือยอดแต้ม

## กติกาประจำแอป

กติกานี้เป็นข้อตกลงของ MVP ไม่ใช่กติกาป๊อกเด้งทุกโต๊ะ

- 52 ใบ ไม่มี Joker สำรับใหม่ทุก round สับ Fisher–Yates ด้วย Node crypto.randomInt
- A=1, 2–9 ตามหน้า, 10/J/Q/K=0 คะแนนคือผลรวม mod 10
- สองใบคะแนน 8/9 เป็นป๊อก ห้ามจั่ว ป๊อกชนะไม่ป๊อก ถ้าเจ้ามือป๊อกเปิดทันที
- ผู้เล่นที่ไม่ป๊อกเลือกอยู่/จั่วพร้อมกันก่อนเจ้ามือ จั่วเพิ่มได้หนึ่งใบ
- เวลาแต่ละช่วงตัดสินใจ 20 วินาที หมดเวลาให้อยู่
- คู่หรือสองใบดอกเดียวกัน 2 เด้ง สามใบดอกเดียวกัน 3 เด้ง ไม่คูณซ้อน
- เทียบป๊อกก่อน แล้วคะแนน เด้งไม่ตัดสินผู้ชนะ เสมอไม่โอนแต้ม
- ใช้เด้งของผู้ชนะคูณเดิมพันในการโอนแต้ม ไม่มีตอง เรียง เซียน
- เริ่ม 1,000 แต้ม เดิมพัน 10/20/50 ก่อนเริ่มต้องมีแต้มรองรับแพ้สูงสุด 3 เท่า
- เจ้ามือต้องมีแต้มรองรับเดิมพันรวม ×3
- Host กดเตรียมรอบใหม่หลังจบเพื่อกลับ lobby และรีเซ็ตแต้มทั้งโต๊ะได้ใน lobby

Host กับเจ้ามือเป็น role แยกกัน Host เริ่มรอบได้เมื่อผู้เล่นอื่นรวมเจ้ามือกดพร้อม Host ไม่ต้องกดพร้อมเอง

## Lifecycle และการป้องกันคำสั่งผิด

`LOBBY → DEALING → PLAYER_ACTIONS → DEALER_ACTION → REVEAL → SETTLEMENT → ROUND_END`

กรณีเจ้ามือป๊อกข้าม action phases การชำระใช้ ledger ที่ผลรวมเป็นศูนย์ และตรวจ roundId ว่าชำระแล้วหรือยัง ทุกคำสั่งตรวจ player identity จาก connection, phase, role, payload, roundId และ actionId มี rate limit 20 messages/วินาที/connection, ปิด connection เมื่อ flood 100 messages ในหนึ่งวินาที, transport maxPayload 4 KB

Reconnect ภายใน 60 วินาทีได้ด้วย Colyseus reconnection token ที่เก็บใน sessionStorage ไพ่ยังเป็นมือเดิม ถ้าถึง action deadline ก่อน reconnect ให้อยู่ ถ้าหลุดถาวรหรือกดออกระหว่าง round ยังชำระผลก่อนลบผู้เล่น Host/เจ้ามือย้ายหลังจบรอบหรือใน lobby ไม่เปลี่ยนเจ้ามือกลางเกม

## Production

Deploy ด้วย Node web service เดียว: server เสิร์ฟ React build ที่ `apps/client/dist`, HTTP matchmaking และ WebSocket บนโดเมนเดียวกัน Client production เลือก WSS อัตโนมัติเมื่อเปิดผ่าน HTTPS ไม่ต้องใส่ `VITE_GAME_URL` หากใช้บริการเดียว

Server มี SPA fallback ให้ `/games`, `/rooms/*`, `/play/*`, `/poker/*` และ `/spyfall/*` เพื่อเปิดลิงก์ตรงและ refresh ได้ และ `/health` ตอบ `{ "status": "ok" }` สำหรับตรวจบริการ ไฟล์ assets ที่ Vite ใส่ hash ใช้ cache 1 ปี ส่วน index.html ใช้ no-cache

บริการจริงชื่อ `wong-pai` ใน Render My Workspace ใช้ Node 24, region Singapore, แผน Free, single instance, build `npm ci --include=dev && npm run build`, start `npm start` และ `NODE_ENV=production` Server รับพอร์ตจาก `PORT` ของ Render และ bind `0.0.0.0` เปิด auto-deploy จาก branch `main` ของ `tsrirang-jpg/mini_game_club`

สร้างบริการผ่าน MCP จึงไม่ได้เชื่อม Blueprint อัตโนมัติ `render.yaml` เก็บค่าตั้งสำหรับสร้างซ้ำและตั้ง HTTP health check `/health` ส่วนบริการที่สร้างด้วย MCP ใช้ health check ค่าเริ่มต้นของ Render และมี `/health` ให้ตรวจ HTTP ได้

ทดสอบ production บนเครื่อง: build ก่อน แล้วตั้ง `$env:NODE_ENV='production'; $env:PORT='2568'` และรัน `npm.cmd start` เปิด `http://127.0.0.1:2568/games` หรือทดสอบด้วย `node tests/production-smoke.mjs` ใช้ `GAME_URL` เปลี่ยนปลายทาง browser tests และ `PRODUCTION_GAME_URL` เปลี่ยนปลายทาง WebSocket smoke

Render Free จะพักบริการเมื่อไม่มีการใช้งาน 15 นาที และการเปิดครั้งถัดไปอาจรอประมาณหนึ่งนาที อ่าน [ข้อจำกัดแผน Free](https://render.com/docs/free) หากแยก frontend/backend ให้ตั้ง `VITE_GAME_URL` ก่อน build และตั้ง reverse proxy ให้รองรับ HTTP matchmaking กับ WebSocket upgrade

MVP ใช้ single instance และ memory เมื่อ restart หรือ deploy ใหม่ ห้องและแต้มจะหาย ไม่มีฐานข้อมูล บัญชีถาวร หรือการกู้เกมหลัง process crash เมื่อขยายให้เพิ่ม persistence และ shared matchmaking โดยแต่ละ room มี server เจ้าของเพียงตัวเดียว

## ขอบเขตที่ยังไม่มี

ไม่มีเงินจริง ฝากถอน spectator public matchmaking หรือระบบบัญชี มี text chat ใน Spyfall เท่านั้น ไม่มี persistence/ranking และยังไม่ได้ทดสอบโหลดจำนวนมาก

สถานะการตรวจจริงดู `VERIFICATION.md`
