import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { session, pokerSession, spySession, oldMaidSession } from './session';
import { navigate, subscribeRoute, getRoute } from './router';
import { CreateRoomPage } from './CreateRoomPage';
import { PlayPage } from './PlayPage';
import { GameSelectPage } from './GameSelectPage';
import { PokerCreatePage } from './PokerCreatePage';
import { PokerPlayPage } from './PokerPlayPage';
import { SpyfallCreatePage } from './SpyfallCreatePage';
import { SpyfallPlayPage } from './SpyfallPlayPage';
const OldMaidCreatePage = lazy(() => import('./OldMaidCreatePage').then(module => ({ default: module.OldMaidCreatePage })));
const OldMaidPlayPage = lazy(() => import('./OldMaidPlayPage').then(module => ({ default: module.OldMaidPlayPage })));
import './style.css';
import './pok-rules.css';
import './pok-layout.css';
import './pok-player-layout.css';
import './poker.css';
import './poker-layout.css';
import './poker-pots.css';
import './poker-ring.css';
import './poker-card-clarity.css';
import './poker-sizing.css';
import './poker-desktop.css';
import './poker-mobile-landscape.css';
import './poker-mobile-small-portrait.css';
import './spyfall.css';
import './spyfall-theme.css';
import './spyfall-select.css';
import './club-theme.css';
import './club-play.css';
import './oldmaid.css';
function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const pokerState = useSyncExternalStore(pokerSession.subscribe, pokerSession.getSnapshot);
  const spyState = useSyncExternalStore(spySession.subscribe, spySession.getSnapshot);
  const oldMaidState = useSyncExternalStore(oldMaidSession.subscribe, oldMaidSession.getSnapshot);
  const route = useSyncExternalStore(subscribeRoute, getRoute);
  useEffect(() => {
    if (location.pathname === '/') navigate('/games', true);
    if (location.pathname.startsWith('/oldmaid')) void oldMaidSession.restore(); else if (location.pathname.startsWith('/spyfall')) void spySession.restore(); else if (location.pathname.startsWith('/poker')) void pokerSession.restore(); else void session.restore();
  }, []);
  const match = /^\/play\/([A-F0-9]{10})$/.exec(route.split('?')[0]);
  const join = route.split('?')[0] === '/rooms/join';
  const pokerMatch = /^\/poker\/play\/([A-F0-9]{10})$/.exec(route.split('?')[0]);
  const isPoker = route.startsWith('/poker');
  const spyMatch = /^\/spyfall\/play\/([A-F0-9]{10})$/.exec(route.split('?')[0]);
  const isSpy = route.startsWith('/spyfall');
  const oldMaidMatch = /^\/oldmaid\/play\/([A-F0-9]{10})$/.exec(route.split('?')[0]);
  const isOldMaid = route.startsWith('/oldmaid');
  const kind = isOldMaid ? 'oldmaid' : isSpy ? 'spyfall' : isPoker ? 'poker' : 'pok';
  const playing = Boolean(oldMaidMatch && oldMaidState.snapshot?.code === oldMaidMatch[1] || spyMatch && spyState.snapshot?.code === spyMatch[1] || pokerMatch && pokerState.snapshot?.code === pokerMatch[1] || match && state.snapshot?.code === match[1]);
  const current = isOldMaid ? oldMaidState : isSpy ? spyState : isPoker ? pokerState : state;
  const currentSession = isOldMaid ? oldMaidSession : isSpy ? spySession : isPoker ? pokerSession : session;
  return <div className={`app club-shell theme-${kind}${playing ? ' club-playing' : ''}${isOldMaid ? ' oldmaid-shell' : ''}${isSpy ? ' spy-shell' : ''}${pokerMatch && pokerState.snapshot?.code === pokerMatch[1] ? ' poker-shell' : ''}${match && state.snapshot?.code === match[1] ? ' pok-shell' : ''}`}>
    <header className="top"><a className="brand" href="/games" onClick={e => { e.preventDefault(); navigate('/games'); }}>♠ <span>วงไพ่<small>CARD GAME CLUB</small></span></a><span className="tag">{isOldMaid?'จับคู่ · จั่วไพ่ · เล่นกับเพื่อน':isSpy?'ถาม · จับพิรุธ · โหวต':'เพื่อนและบอท · แต้มจำลอง'}</span></header>
    {current.error && <div className="error" role="alert">{current.error}<button aria-label="ปิดข้อความ" onClick={() => currentSession.clearError()}>×</button></div>}
    {current.status === 'reconnecting' && <div className="notice" role="status">กำลังเชื่อมต่อกลับโต๊ะ… <button onClick={() => currentSession.leave()}>กลับหน้าแรก</button></div>}
    <Suspense fallback={<main className="page-message"><p>กำลังโหลดเกม…</p></main>}>{route.split('?')[0] === '/games' ? <GameSelectPage/> : oldMaidMatch ? <OldMaidPlayPage state={oldMaidState} code={oldMaidMatch[1]}/> : isOldMaid ? <OldMaidCreatePage key={route.split('?')[0]} state={oldMaidState} join={route.split('?')[0] === '/oldmaid/rooms/join'}/> : spyMatch ? <SpyfallPlayPage state={spyState} code={spyMatch[1]}/> : isSpy ? <SpyfallCreatePage key={route.split('?')[0]} state={spyState} join={route.split('?')[0] === '/spyfall/rooms/join'}/> : pokerMatch ? <PokerPlayPage state={pokerState} code={pokerMatch[1]}/> : isPoker ? <PokerCreatePage key={route.split('?')[0]} state={pokerState} join={route.split('?')[0] === '/poker/rooms/join'}/> : match ? <PlayPage state={state} code={match[1]}/> : <CreateRoomPage key={join ? 'join' : 'create'} state={state} join={join}/>}</Suspense>
    <footer>{isOldMaid?'จับคู่ให้หมดมือ · สนุกกับเพื่อนทั้งวง':isSpy?'เล่นเพื่อความสนุกกับเพื่อน · บทบาทลับเฉพาะคุณ':'เล่นเพื่อความสนุก · แต้มจำลอง ไม่มีมูลค่าเงินจริง'}</footer>
  </div>;
}
createRoot(document.getElementById('root')!).render(<App/>);
