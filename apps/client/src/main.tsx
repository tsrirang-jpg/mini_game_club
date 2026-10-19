import { lazy, Suspense, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { session, pokerSession, spySession, oldMaidSession, whoAmISession, liarSession, underSession } from './session';
import type { GameSession, SessionState } from './session';
import { navigate, subscribeRoute, getRoute } from './router';
import { GameSelectPage } from './GameSelectPage';
import { games } from './games';
import { BrandLogo } from './components/ui/BrandLogo';
import type { GameKind } from './games';
const CreateRoomPage = lazy(() => import('./CreateRoomPage').then(m => ({ default: m.CreateRoomPage })));
const PlayPage = lazy(() => import('./PlayPage').then(m => ({ default: m.PlayPage })));
const PokerCreatePage = lazy(() => import('./PokerCreatePage').then(m => ({ default: m.PokerCreatePage })));
const PokerPlayPage = lazy(() => import('./PokerPlayPage').then(m => ({ default: m.PokerPlayPage })));
const SpyfallCreatePage = lazy(() => import('./SpyfallCreatePage').then(m => ({ default: m.SpyfallCreatePage })));
const SpyfallPlayPage = lazy(() => import('./SpyfallPlayPage').then(m => ({ default: m.SpyfallPlayPage })));
const OldMaidCreatePage = lazy(() => import('./OldMaidCreatePage').then(m => ({ default: m.OldMaidCreatePage })));
const OldMaidPlayPage = lazy(() => import('./OldMaidPlayPage').then(m => ({ default: m.OldMaidPlayPage })));
const WhoAmICreatePage = lazy(() => import('./WhoAmICreatePage').then(m => ({ default: m.WhoAmICreatePage })));
const WhoAmIPlayPage = lazy(() => import('./WhoAmIPlayPage').then(m => ({ default: m.WhoAmIPlayPage })));
const LiarCreatePage = lazy(() => import('./LiarCreatePage').then(m => ({ default: m.LiarCreatePage })));
const LiarPlayPage = lazy(() => import('./LiarPlayPage').then(m => ({ default: m.LiarPlayPage })));
const UndercoverCreatePage = lazy(() => import('./UndercoverCreatePage').then(m => ({ default: m.UndercoverCreatePage })));
const UndercoverPlayPage = lazy(() => import('./UndercoverPlayPage').then(m => ({ default: m.UndercoverPlayPage })));
import './style.css';
import './pok-rules.css';
import './pok-layout.css';
import './pok-player-layout.css';
import './poker.css';
import './poker-pots.css';
import './spyfall.css';
import './spyfall-theme.css';
import './spyfall-select.css';
import './club-theme.css';
import './club-play.css';
import './oldmaid.css';
import './club-desktop.css';
import './club-entry-desktop.css';
import './poker-midnight.css';
import './pok-dealer-arena.css';

function GameShell({ kind, playing = false, children, state, controls }: {
  kind: GameKind; playing?: boolean; children: ReactNode;
  state?: Pick<SessionState, 'status' | 'error'>; controls?: { leave(): void; clearError(): void };
}) {
  const metadata = games[kind];
  return <div className={`app club-shell theme-${kind}${playing ? ' club-playing' : ''}${kind === 'oldmaid' ? ' oldmaid-shell' : ''}${kind === 'spyfall' ? ' spy-shell' : ''}${playing && kind === 'poker' ? ' poker-shell' : ''}${playing && kind === 'pok' ? ' pok-shell' : ''}`}>
    <header className="top"><a className="brand" href="/games" onClick={event => { event.preventDefault(); navigate('/games'); }} aria-label="วงเซียน · Mini Game Club"><BrandLogo/></a><span className="tag">{metadata.tag}</span></header>
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
  if (path.startsWith('/undercover')) return <GameScreen key="undercover" store={underSession} kind="undercover" code={code}>{state => code ? <UndercoverPlayPage state={state} code={code}/> : <UndercoverCreatePage key={path} state={state} join={path === '/undercover/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/liar')) return <GameScreen key="liar" store={liarSession} kind="liar" code={code}>{state => code ? <LiarPlayPage state={state} code={code}/> : <LiarCreatePage key={path} state={state} join={path === '/liar/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/whoami')) return <GameScreen key="whoami" store={whoAmISession} kind="whoami" code={code}>{state => code ? <WhoAmIPlayPage state={state} code={code}/> : <WhoAmICreatePage key={path} state={state} join={path === '/whoami/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/oldmaid')) return <GameScreen key="oldmaid" store={oldMaidSession} kind="oldmaid" code={code}>{state => code ? <OldMaidPlayPage state={state} code={code}/> : <OldMaidCreatePage key={path} state={state} join={path === '/oldmaid/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/spyfall')) return <GameScreen key="spyfall" store={spySession} kind="spyfall" code={code}>{state => code ? <SpyfallPlayPage state={state} code={code}/> : <SpyfallCreatePage key={path} state={state} join={path === '/spyfall/rooms/join'}/>}</GameScreen>;
  if (path.startsWith('/poker')) return <GameScreen key="poker" store={pokerSession} kind="poker" code={code}>{state => code ? <PokerPlayPage state={state} code={code}/> : <PokerCreatePage key={path} state={state} join={path === '/poker/rooms/join'}/>}</GameScreen>;
  return <GameScreen key="pok" store={session} kind="pok" code={code}>{state => code ? <PlayPage state={state} code={code}/> : <CreateRoomPage key={path} state={state} join={path === '/rooms/join'}/>}</GameScreen>;
}
createRoot(document.getElementById('root')!).render(<App/>);
