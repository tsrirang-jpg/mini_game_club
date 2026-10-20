import { BrandLogo } from './components/ui/BrandLogo';
import { useDeadlineNow } from './hooks/useDeadlineNow';
import { CopyRoomCodeButton } from './components/ui/CopyRoomCodeButton';
import { SpyfallSelect as ClubSelect } from './SpyfallSelect';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { session } from './session';
import type { SessionState } from './session';
import { navigate } from './router';
import { Card, Rules, phaseLabel } from './components';
import { handLabel } from '../../../packages/shared/src/index';
import { PokSeat } from './components/pok/PokSeat';
import type { ArenaPosition } from './components/pok/PokSeat';
import { PokIcon } from './components/pok/PokArenaArtwork';
import { PokTurnStage } from './components/pok/PokTurnStage';

function PokPanel({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} className="pok-dialog" aria-labelledby="pok-dialog-title" onCancel={close}>
    <div className="pok-dialog-header"><h2 id="pok-dialog-title">{title}</h2><button aria-label="ปิดหน้าต่าง" onClick={close}>✕</button></div>
    <div className="pok-dialog-body">{children}</div>
  </dialog>;
}
export function PlayPage({ state, code }: { state: SessionState; code: string }) {
  const [panel, setPanel] = useState<'rules' | 'table' | 'catches' | null>(null);
  const [catchTarget, setCatchTarget] = useState('');
  const s = state.snapshot;
  const now = useDeadlineNow(s?.deadline);
  if (!s || s.code !== code) return <main className="page-message"><h1>{state.status === 'reconnecting' || state.status === 'connecting' ? 'กำลังกลับเข้าโต๊ะ…' : 'ยังไม่ได้เข้าห้องนี้'}</h1><p>ห้อง {code}</p>{state.status === 'idle' && <button className="primary" onClick={() => navigate('/rooms/join?code=' + code)}>เข้าห้องนี้</button>}</main>;
  const me = s.players.find(p => p.id === state.playerId);
  const idle = s.phase === 'LOBBY' || s.phase === 'ROUND_END';
  const host = s.hostId === state.playerId; const dealer = s.dealerId === state.playerId;
  const active = state.status === 'connected';
  const canAct = !!(active && me && !me.acted && now < s.deadline && ((s.phase === 'PLAYER_ACTIONS' && !dealer) || (s.phase === 'DEALER_ACTION' && dealer)));
  const seconds = s.deadline ? Math.max(0, Math.min(Math.ceil(s.rules.actionMs / 1000), Math.ceil((s.deadline - now) / 1000))) : 0;
  const deciding = s.phase === 'PLAYER_ACTIONS' || s.phase === 'DEALER_ACTION';
  const opponents = [...s.players].filter(p => p.id !== state.playerId).sort((a,b) => a.seat - b.seat);
  const featured = opponents.find(p => p.id === s.dealerId) ?? opponents[0];
  const sidePlayers = opponents.filter(p => p.id !== featured?.id);
  const sidePositions: ArenaPosition[] = ['left-top','left-bottom','right-top','right-bottom'];
  const largeTable = s.players.length > 6;
  const sideSlots = [0,2,3,4,5,6,7,8];
  const catches = s.catches ?? [];
  const catchable = s.players.filter(p => p.id !== s.dealerId && p.cardCount === 3 && !catches.some(r => r.id === p.id));
  const selectedCatch = catchable.find(p => p.id === catchTarget)?.id ?? catchable[0]?.id;
  const canCatch = canAct && dealer && me?.cardCount === 2 && catchable.length > 0;
  return (<main className={"game pok-game dealer-arena" + (canCatch ? " has-catch" : "")}>
      <div className="room-bar"><div className="pok-room-id"><BrandLogo compact/><strong>{s.code}</strong><CopyRoomCodeButton code={s.code}/></div><div className="pok-navigation"><span className="connection" aria-label={active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}><i className={active ? 'online' : ''}/><span>{active ? 'เชื่อมต่อแล้ว' : 'กำลังเชื่อมต่อใหม่'}</span></span><button className="small" aria-label="กติกาป๊อกเด้ง" onClick={() => setPanel('rules')}><PokIcon name="rules"/>กติกา</button><button className="small" aria-label="จัดการโต๊ะป๊อกเด้ง" onClick={() => setPanel('table')}><PokIcon name="table"/>โต๊ะ</button><button className="ghost small" onClick={() => session.leave()}><PokIcon name="leave"/>ออกจากห้อง</button></div></div>
      <div className="game-layout"><section className="table-area">
        <div className="phase"><span>{canAct && 'ถึงตาคุณ · '}{phaseLabel[s.phase]} · รอบ {s.roundId || '–'}</span><span className="pok-clock">{s.players.length}/{s.rules.maxPlayers} คน</span></div>
        <div className="table" data-layout={largeTable ? 'large' : 'arena'} data-players={s.players.length} data-opponents={opponents.length} data-side-count={sidePlayers.length}>
          <div className="seats pok-table-seats">
            <div className="pok-opponents">{opponents.map(p => <PokSeat key={p.id} player={p} s={s} state={state} position={p.id===featured?.id?'top':sidePositions[sidePlayers.findIndex(side=>side.id===p.id)]} gridSlot={largeTable ? p.id === featured?.id ? 1 : sideSlots[sidePlayers.findIndex(side => side.id === p.id)] : undefined} showCatches={() => setPanel('catches')}/>)}</div>
            <PokTurnStage phase={s.phase} canAct={canAct} dealer={dealer} canCatch={canCatch}/>
            {me && <section className="pok-self" aria-label="ไพ่ของคุณ"><PokSeat player={me} s={s} state={state} showCatches={() => setPanel('catches')}/></section>}
          </div>
        </div>
      </section></div>
      <section className={'pok-action-dock'+(dealer&&deciding?' is-dealer-turn':'')+(idle?' is-waiting':'')} aria-label="การเล่นป๊อกเด้ง">
        <div className="arena-dock-clock"><span>{deciding ? canAct ? 'ตาของคุณ' : 'เวลาตัดสินใจ' : idle ? 'พร้อมแล้ว' : phaseLabel[s.phase]}</span><div><PokIcon name="clock"/><strong>{deciding ? seconds : idle ? s.players.filter(p=>p.ready||p.id===s.hostId).length+'/'+s.players.length : '–'}</strong><small>{deciding ? 'วินาที' : idle ? 'คน' : ''}</small></div>{deciding && <span className="pok-time" role="progressbar" aria-label="เวลาตัดสินใจ" aria-valuemin={0} aria-valuemax={Math.ceil(s.rules.actionMs/1000)} aria-valuenow={seconds}><i style={{width:Math.max(0,Math.min(100,(s.deadline-now)/s.rules.actionMs*100))+'%'}}/></span>}</div>
        <div className="arena-control-content">
        {canCatch && <div className="pok-catch-controls"><ClubSelect<string> compact label="จับผู้เล่น 3 ใบ" value={selectedCatch??''} onChange={setCatchTarget} options={catchable.map(p=>({value:p.id,label:p.name}))}/><button disabled={!selectedCatch} onClick={() => session.send('catch', selectedCatch)}>จับด้วยไพ่ 2 ใบ</button></div>}
        {idle && me ? <div className="pok-round-controls">
          {!dealer && <div className="pok-bet-controls"><span>วางแต้ม</span><div className="bets">{s.rules.bets.map(bet => <button key={bet} className={me.bet === bet ? 'selected' : ''} disabled={!active} onClick={() => session.send('setBet', bet)}>{bet}</button>)}</div></div>}
          {host && <div className="pok-dealer-control"><ClubSelect<string> compact label="เจ้ามือ" disabled={!active} value={s.dealerId} onChange={value=>session.send('selectDealer',value)} options={s.players.filter(p=>p.connected).map(p=>({value:p.id,label:p.name}))}/></div>}
          {!host && <button className="primary" disabled={!active} onClick={() => session.send('setReady', !me.ready)}>{me.ready ? 'ยกเลิกพร้อม' : 'พร้อมเล่น'}</button>}
          {host && (s.phase === 'LOBBY' ? <button className="primary" disabled={!active || s.players.length < 2 || s.players.some(p => !p.connected || (p.id !== s.hostId && !p.ready))} onClick={() => session.send('startRound')}>เริ่มรอบ</button> : <button className="primary" disabled={!active} onClick={() => session.send('prepareRound')}>เตรียมรอบใหม่</button>)}
        </div> : <div className="action-bar">{canAct ? <><button className="primary" aria-label="จั่วอีกใบ" onClick={() => session.send('draw')}><PokIcon name="draw"/><span>จั่วไพ่</span></button><button className="ghost" onClick={() => session.send('stand')}><PokIcon name="stand"/><span>อยู่</span></button></> : <p>{me?.acted ? 'คุณตัดสินใจแล้ว รอสรุปผลรอบ' : 'รอจังหวะเล่นของคุณ'}</p>}</div>}
        </div><div className="arena-bet-summary"><span>{dealer?'บทบาทของคุณ':'เดิมพันรอบนี้'}</span><strong>{dealer?'เจ้ามือ':me?.bet??0} {!dealer&&<small>แต้ม</small>}</strong></div>
      </section>
      {panel && <PokPanel title={panel === 'rules' ? 'กติกาป๊อกเด้ง' : panel === 'catches' ? 'ผลการจับ' : 'จัดการโต๊ะป๊อกเด้ง'} close={() => setPanel(null)}>
        {panel === 'rules' ? <Rules/> : panel === 'catches' ? <><p className="fine">ผลจับระหว่างรอบเป็นผลชั่วคราว หากเจ้ามือจั่วจะเทียบผลจับทุกคนใหม่ด้วยไพ่ครบ 3 ใบ แม้จับครบทุกคนยังจั่วหรืออยู่ได้ ชำระแต้มครั้งเดียวเมื่อจบรอบ</p>{catches.map(r => <section className="pok-catch-detail" key={r.id}><h3>{s.players.find(p => p.id === r.id)?.name ?? 'ผู้เล่น'}</h3><div className="pok-catch-hands"><div><small>เจ้ามือ · {r.dealerValue && handLabel(r.dealerValue)}{r.catchRecompared && ' · เทียบหลังจั่ว'}</small><div className="hand">{r.dealerCards?.map((card, i) => <Card key={i} card={card}/>)}</div></div><div><small>ผู้เล่น · {handLabel(r)}</small><div className="hand">{r.cards.map((card, i) => <Card key={i} card={card}/>)}</div></div></div><p>{r.outcome === 'TIE' ? 'เสมอ' : r.outcome === 'WIN' ? 'ผู้เล่นชนะ' : 'เจ้ามือชนะ'} · ผู้เล่น {r.delta > 0 ? '+' : ''}{r.delta} แต้ม</p></section>)}</> : <div className="pok-table-settings"><h2>โต๊ะของเรา <small>{s.players.length}/{s.rules.maxPlayers} คน</small></h2>
        {host && s.phase === 'LOBBY' && <section className="bot-controls"><h3>เล่นกับบอท</h3><button className="ghost full" disabled={!active || s.players.length >= s.rules.maxPlayers} onClick={() => session.send('addBot')}>เพิ่มบอท</button>{s.players.filter(p => p.isBot).map(bot => <div className="bot-row" key={bot.id}><span>{bot.name}</span><button className="small" disabled={!active} aria-label={'นำ ' + bot.name + ' ออก'} onClick={() => session.send('removeBot', bot.id)}>นำออก</button></div>)}<p className="fine">บอทพร้อมเล่นอัตโนมัติ และเลือกเป็นเจ้ามือได้</p></section>}
        {host && s.phase === 'LOBBY' && <button className="ghost full" disabled={!active} onClick={() => session.send('resetTablePoints')}>รีเซ็ตทั้งโต๊ะเป็น 1,000 แต้ม</button>}
        <button className="ghost full" onClick={() => session.leave('/games')}>← กลับหน้าแรก</button><p className="fine">แต้มจำลอง ไม่มีมูลค่าเงินจริง<br/>ห้องและแต้มจะหายเมื่อ server restart</p></div>}
      </PokPanel>}
    </main>);
}
