import {useEffect, useRef, useState} from 'react';
import type {ReactNode} from 'react';
import type {SessionState} from '../../session';
import {games} from '../../games';
import {MenuGameArtwork} from '../ui/MenuGameArtwork';
import {RoadIcon} from '../../roadfighter/RoadIcon';
import {RoomEntryForm, RoomEntryTabs, CurrentRoomNotice} from './RoomEntryForm';
import type {RoomEntryFormProps} from './RoomEntryForm';
import {RoomEntryHeader} from './RoomEntryHeader';
import {entryConfig} from './room-entry-config';
import type {RoomGame} from './room-entry-config';
import './room-entry.css';

interface Props {
  game: RoomGame;
  join: boolean;
  state: {status: SessionState['status']; snapshot?: {code: string} | null};
  connect: RoomEntryFormProps['connect'];
  leave(): void;
  rules: ReactNode;
  createSettings?: ReactNode;
}
function RoomEntryRules({children, onClose}: {children: ReactNode; onClose(): void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.querySelectorAll('details').forEach(detail => {detail.open = true;});
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return <dialog ref={ref} className="room-entry-dialog" aria-labelledby="entry-rules-title" onCancel={onClose}>
    <div className="room-entry-dialog-heading"><h2 id="entry-rules-title">วิธีเล่นและกติกา</h2>
      <button type="button" aria-label="ปิดวิธีเล่น" onClick={onClose}>×</button></div>
    {children}
    <button type="button" className="primary" onClick={onClose}>เข้าใจแล้ว</button>
  </dialog>;
}
export function RoomEntryPage({game, join, state, connect, leave, rules, createSettings}: Props) {
  const [help, setHelp] = useState(false);
  const config = entryConfig(game), metadata = games[game];
  const basePath = metadata.path.replace(/\/create$/, '');
  const playPath = basePath.replace(/\/rooms$/, '') + '/play';
  const language = /[\u0E00-\u0E7F]/.test(metadata.name) ? 'th' : 'en';
  return <>
    <RoomEntryHeader onHelp={() => setHelp(true)}/>
    <main className="room-entry-page" data-game={game} data-mode={join ? 'join' : 'create'}>
      <div className="room-entry-heading">
        <div><h1 lang={language}>{metadata.name}</h1>{config.subtitle && <span className="room-entry-subtitle">{config.subtitle}</span>}</div>
        <div className="room-entry-caption"><span className="player-count-pill"><RoadIcon name="user"/>{metadata.players}</span><p>{config.caption}</p></div>
      </div>
      <div className="room-entry-grid">
        <section className="room-entry-art" aria-label={'ภาพเกม ' + metadata.name}><MenuGameArtwork game={game} eager/></section>
        <section className="entry room-entry-form" aria-label={join ? 'เข้าห้อง ' + metadata.name : 'สร้างห้อง ' + metadata.name}>
          <h2>{join ? 'เข้าห้องเพื่อน' : 'สร้างห้องใหม่'}</h2>
          <RoomEntryTabs basePath={basePath} join={join}/>
          <CurrentRoomNotice code={state.snapshot?.code} playPath={playPath} leave={leave}/>
          <RoomEntryForm join={join} status={state.status} connect={connect}
            gameName={metadata.name}
            botLimit={config.botLimit} defaultBots={config.defaultBots} createSettings={createSettings}
            namePlaceholder="เพื่อนจะเห็นชื่อนี้" codePlaceholder="กรอกรหัสห้อง 10 ตัวอักษร"/>
        </section>
        <section className="room-entry-facts">
          <h2><RoadIcon name="grid"/>ข้อมูลเกม</h2>
          <dl><div><RoadIcon name="user"/><dt>{metadata.category === 'party' ? 'ผู้เล่นจริง' : 'ผู้เล่น'}</dt><dd>{metadata.players}</dd></div>{config.facts.map(([icon, label, value]) => <div key={label}><RoadIcon name={icon}/><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        </section>
        <section className="room-entry-guide">
          <h2><RoadIcon name="help"/>วิธีเล่นแบบย่อ</h2>
          <ol>{config.steps.map(([icon, label]) => <li key={label}><RoadIcon name={icon}/><span>{label}</span></li>)}</ol>
          <button type="button" className="room-entry-rules-link" onClick={() => setHelp(true)}>กติกาฉบับเต็ม <RoadIcon name="right"/></button>
        </section>
      </div>
    </main>
    {help && <RoomEntryRules onClose={() => setHelp(false)}>{rules}</RoomEntryRules>}
  </>;
}
