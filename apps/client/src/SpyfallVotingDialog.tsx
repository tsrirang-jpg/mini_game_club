import { useEffect, useRef, useState } from 'react';
import { PlayerVotingContent } from './components/ui/PlayerVotingContent';
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
  const seconds = Math.max(0, Math.min(Math.ceil(s.votingDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const canVote = active && !!me && !confirmed && !submitting && now < s.deadline;

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
    <PlayerVotingContent title="ใครคือ Spy?" eyebrow={`SPYFALL · ภารกิจที่ ${s.roundId}`} description="เลือกผู้ต้องสงสัย 1 คน แล้วกดยืนยันโหวต"
      players={s.players.map(p=>({...p,confirmed:p.hasVoted}))} playerId={playerId} selected={ownVote??selected}
      canVote={canVote} confirmed={confirmed} submitting={submitting} active={active} seconds={seconds}
      progress={(s.deadline-now)/s.votingDurationMs*100} error={error}
      note="ยืนยันครบทุกคนจะปิดโหวตทันที · ต้องมีเสียงเกินครึ่งเพื่อจับ Spy"
      select={setSelected} confirm={()=>{if(canVote&&selected){setSubmitting(true);confirm(selected);}}}/>
  </dialog>;
}
