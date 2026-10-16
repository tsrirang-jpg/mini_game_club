import { useEffect, useRef, useState } from 'react';
import type { SpySnapshot } from '../../../packages/shared/src/spyfall';

interface Props {
  snapshot: SpySnapshot;
  active: boolean;
  now: number;
  error: string;
  confirm(answer: string): void;
  surrender(): void;
}

export function SpyfallGuessDialog({ snapshot: s, active, now, error, confirm, surrender }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [answer, setAnswer] = useState('');
  const [pending, setPending] = useState<'answer' | 'surrender' | null>(null);
  const seconds = Math.max(0, Math.min(Math.ceil(s.guessDurationMs / 1000), Math.ceil((s.deadline - now) / 1000)));
  const canAct = active && !pending && now < s.deadline;

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    inputRef.current?.focus({ preventScroll: true });
    return () => { dialog.close(); document.body.style.overflow = previousOverflow; };
  }, []);
  useEffect(() => { if (!active || error) setPending(null); }, [active, error]);

  return <dialog ref={dialogRef} className="spy-voting-dialog spy-guess-dialog" aria-labelledby="spy-guess-title" aria-describedby="spy-guess-description" onCancel={e => e.preventDefault()}>
    <header className="spy-voting-heading">
      <span className="spy-voting-emblem" aria-hidden="true">◉</span>
      <div><span className="spy-voting-eyebrow">SPYFALL · โอกาสสุดท้าย</span><h2 id="spy-guess-title">Spy ตอบสถานที่</h2><p id="spy-guess-description">คุณถูกจับแล้ว แต่ยังพลิกกลับมาชนะได้</p></div>
    </header>
    <form className="spy-caught-guess-form" onSubmit={e => { e.preventDefault(); if (canAct && answer.trim()) { setPending('answer'); confirm(answer.trim()); } }}>
      <div className="spy-guess-fields">
        <label htmlFor="spy-caught-answer">เฉลยสถานที่<input ref={inputRef} id="spy-caught-answer" type="text" maxLength={80} autoComplete="off" required disabled={!canAct} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="คุณคิดว่าที่นี่คือที่ไหน?"/></label>
        <p>ตอบได้ครั้งเดียว · ตอบถูก Spy ชนะ<br/>ตอบผิด ยอมแพ้ หรือหมดเวลา คนทั่วไปชนะ</p>
      </div>
      <div className="spy-guess-footer">
        <div className="spy-voting-progress"><span role="status">{!active ? 'กำลังเชื่อมต่อใหม่…' : pending ? 'กำลังส่ง…' : seconds === 0 ? 'หมดเวลา กำลังสรุปผล…' : 'เวลาตอบยังนับต่อขณะพิมพ์'}</span><span className={`spy-voting-clock ${seconds <= 10 ? 'urgent' : ''}`} role="timer" aria-label="เวลาตอบที่เหลือ"><strong>{seconds}</strong> วินาที</span></div>
        <div className="spy-voting-time-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, (s.deadline - now) / s.guessDurationMs * 100))}%` }}/></div>
        <div className="spy-guess-buttons"><button type="button" className="spy-guess-surrender" disabled={!canAct} onClick={() => { if (canAct) { setPending('surrender'); surrender(); } }}>{pending === 'surrender' ? 'กำลังยอมแพ้…' : 'ยอมแพ้'}</button><button type="submit" className="spy-voting-confirm" disabled={!canAct || !answer.trim()}>{pending === 'answer' ? 'กำลังส่ง…' : 'ยืนยันคำตอบ'}</button></div>
        {error && <p className="spy-voting-error" role="alert">{error}</p>}
      </div>
    </form>
  </dialog>;
}
