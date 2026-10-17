import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { session, pokerSession, spySession, oldMaidSession } from './session';
import type { GameSession, SessionState } from './session';
import { navigate, subscribeRoute, getRoute } from './router';
import { GameSelectPage } from './GameSelectPage';
import { games } from './games';
import type { GameKind } from './games';
const CreateRoomPage = lazy(() => import('./CreateRoomPage').then(m => ({ default: m.CreateRoomPage })));
const PlayPage = lazy(() => import('./PlayPage').then(m => ({ default: m.PlayPage })));
const PokerCreatePage = lazy(() => import('./PokerCreatePage').then(m => ({ default: m.PokerCreatePage })));
const PokerPlayPage = lazy(() => import('./PokerPlayPage').then(m => ({ default: m.PokerPlayPage })));
const SpyfallCreatePage = lazy(() => import('./SpyfallCreatePage').then(m => ({ default: m.SpyfallCreatePage })));
const SpyfallPlayPage = lazy(() => import('./SpyfallPlayPage').then(m => ({ default: m.SpyfallPlayPage })));
const OldMaidCreatePage = lazy(() => import('./OldMaidCreatePage').then(m => ({ default: m.OldMaidCreatePage })));
const OldMaidPlayPage = lazy(() => import('./OldMaidPlayPage').then(m => ({ default: m.OldMaidPlayPage })));
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
import './club-desktop.css';
import './club-entry-desktop.css';

function GameShell({ kind, playing = false, children, state, controls }: {
  kind: GameKind; playing?: boolean; children: ReactNode;
  state?: Pick<SessionState, 'status' | 'error'>; controls?: { leave(): void; clearError(): void };
}) {
  const metadata = games[kind];
  return <div className={`app club-shell theme-${kind}${playing ? ' club-playing' : ''}${kind === 'oldmaid' ? ' oldmaid-shell' : ''}${kind === 'spyfall' ? ' spy-shell' : ''}${playing && kind === 'poker' ? ' poker-shell' : ''}${playing && kind === 'pok' ? ' pok-shell' : ''}`}>
    <header className="top"><a className="brand" href="/games" onClick={event => { event.preventDefault(); navigate('/games'); }}>♠ <span>วงไพ่<small>CARD GAME CLUB</small></span></a><span className="tag">{metadata.tag}</span></header>
    {state?.error && <div className="error" role="alert">{state.error}<button aria-label="ปิดข้อความ" onClick={() => controls?.clearError()}>×</button></div>}
    {state?.status === 'reconnecting' && <div className="notice" role="status">กำลังเชื่อมต่อกลับโต๊ะ… <button onClick={() => controls?.leave()}>กลับหน้าแรก</button></div>}
    <Suspense fallback={<main className="page-message"><p>กำลังโหลดเกม…</p></main>}>{children}</Suspense>
    <footer>{metadata.footer}</footer>
  </div>;
}
// Only the selected game subscribes to room messages. Hidden rooms may keep their
// connection for returning players without re-rendering the current screen.
function GameScreen<S extends { code: string; roundId: number }, A extends string>({ store, kind, code, children }: {
  store: GameSession<S, A>; kind: GameKind; code?: string; children(state: SessionState<S>): ReactNode;
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  useEffect(() => { void store.restore(); }, [store]);
  return <GameShell kind={kind} playing={!!code && state.snapshot?.code === code} state={state} controls={store}>{children(state)}</GameShell>;
}
function App() {
  const route = useSyncExternalStore(subscribeRoute, getRoute);
  const path = route.split('?')[0];
  useEffect(() => { if (path === '/') navigate('/games', true); }, [path]);
  if (path === '/games' || path === '/') return <GameShell kind="pok"><GameSelectPage/></GameShell>;
  const code = /\/play\/([A-F0-9]{10})$/.exec(path)?.[1];
  if (path.startsWith('/oldmaid')) return <GameScreen key="oldmaid" store={oldMaidSession} kind="oldmaid" code={code}>{state => code ? <OldMaidPlayPage state={state} code={code}/> : <OldMaidCreatePage key={path} state={state} join={path === '/oldmaid/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/spyfall')) return <GameScreen key="spyfall" store={spySession} kind="spyfall" code={code}>{state => code ? <SpyfallPlayPage state={state} code={code}/> : <SpyfallCreatePage key={path} state={state} join={path === '/spyfall/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/poker')) return <GameScreen key="poker" store={pokerSession} kind="poker" code={code}>{state => code ? <PokerPlayPage state={state} code={code}/> : <PokerCreatePage key={path} state={state} join={path === '/poker/rooms/join'}/>}</GameScreen>;
  return <GameScreen key="pok" store={session} kind="pok" code={code}>{state => code ? <PlayPage state={state} code={code}/> : <CreateRoomPage key={path} state={state} join={path === '/rooms/join'}/>}</GameScreen>;
}
createRoot(document.getElementById('root')!).render(<App/>);
