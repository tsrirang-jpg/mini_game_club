import { useEffect, useRef, useState } from 'react';
import type { SpySnapshot } from '../../../packages/shared/src/spyfall';

interface Props {
  snapshot: SpySnapshot;
  playerId: string;
  ownVote: string | null;
  active: boolean;
  now: number;
  error: string;
  confirm(target: string): void;
}

export function SpyfallVotingDialog({ snapshot: s, playerId, ownVote, active, now, error, confirm }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(ownVote);
  const [submitting, setSubmitting] = useState(false);
  const me = s.players.find(p => p.id === playerId);
  const confirmed = !!me?.hasVoted || !!ownVote;
  const voted = s.players.filter(p => p.hasVoted).length;
  const seconds = Math.max(0, Math.min(Math.ceil(s.votingDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const canVote = active && !!me && !confirmed && !submitting && now < s.deadline;
  const selectedName = s.players.find(p => p.id === (ownVote ?? selected))?.name;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => { if (ownVote) setSelected(ownVote); }, [ownVote]);
  useEffect(() => { if (!active || error) setSubmitting(false); }, [active, error]);

  return <dialog ref={dialogRef} className="spy-voting-dialog" aria-labelledby="spy-voting-title" aria-describedby="spy-voting-description" onCancel={e => e.preventDefault()}>
    <header className="spy-voting-heading">
      <span className="spy-voting-emblem" aria-hidden="true">⌖</span>
      <div><span className="spy-voting-eyebrow">SPYFALL · ภารกิจที่ {s.roundId}</span><h2 id="spy-voting-title">ใครคือ Spy?</h2><p id="spy-voting-description">เลือกผู้ต้องสงสัย 1 คน แล้วกดยืนยันโหวต</p></div>
      <span className="spy-voting-round" aria-hidden="true">?</span>
    </header>
    <ul className="spy-voting-list" aria-label="รายชื่อผู้ต้องสงสัย">
      {[...s.players].sort((a, b) => a.seat - b.seat).map(p => {
        const own = p.id === playerId;
        const chosen = p.id === (ownVote ?? selected);
        return <li key={p.id}>
          <button type="button" className={`spy-vote-option ${chosen ? 'chosen' : ''} ${own ? 'own' : ''}`} aria-label={`สงสัย ${p.name}`} aria-pressed={chosen} disabled={!canVote || own} onClick={() => setSelected(p.id)}>
            <span className={`agent-avatar avatar-${p.seat % 4}`} aria-hidden="true">{Array.from(p.name).slice(0, 2).join('')}</span>
            <span className="spy-vote-identity"><strong title={p.name}>{p.name}</strong><span>{own ? 'คุณ · เลือกตัวเองไม่ได้' : !p.connected ? 'กำลังเชื่อมต่อใหม่' : 'ผู้ต้องสงสัย'}</span></span>
            <span className={`spy-vote-stamp ${p.hasVoted ? 'done' : ''}`}>{p.hasVoted ? '✓ ยืนยันแล้ว' : 'รอโหวต'}</span>
            <span className="spy-vote-check" aria-hidden="true">{chosen ? '✓' : ''}</span>
          </button>
        </li>;
      })}
    </ul>
    <div className="spy-voting-footer">
      <div className="spy-voting-progress"><span role="status">ยืนยันแล้ว <strong>{voted}/{s.players.length}</strong> คน</span><span className={`spy-voting-clock ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-label="เวลาโหวตที่เหลือ"><strong>{seconds}</strong> วินาที</span></div>
      <div className="spy-voting-time-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (s.deadline - now) / s.votingDurationMs * 100))}%` }}/></div>
      <div className="spy-voting-confirmation">
        <div className="spy-voting-choice" aria-live="polite"><span>{confirmed ? 'ยืนยันเสียงของคุณแล้ว' : 'ผู้ที่คุณเลือก'}</span><strong>{selectedName ?? 'ยังไม่ได้เลือก'}</strong><small>{!active ? 'กำลังเชื่อมต่อใหม่…' : confirmed ? 'รอคนอื่นยืนยัน หรือรอหมดเวลา' : submitting ? 'กำลังส่งคะแนน…' : seconds === 0 ? 'หมดเวลา กำลังสรุปผล…' : 'เปลี่ยนตัวเลือกได้ก่อนกดยืนยัน'}</small></div>
        <button type="button" className="spy-voting-confirm" disabled={!canVote || !selected} onClick={() => { if (canVote && selected) { setSubmitting(true); confirm(selected); } }}>{confirmed ? '✓ ยืนยันแล้ว' : submitting ? 'กำลังส่ง…' : 'ยืนยันโหวต'}</button>
      </div>
      <p className="spy-voting-note">ยืนยันครบทุกคนจะปิดโหวตทันที · ต้องมีเสียงเกินครึ่งเพื่อจับ Spy</p>
      {error && <p className="spy-voting-error" role="alert">{error}</p>}
    </div>
  </dialog>;
}
