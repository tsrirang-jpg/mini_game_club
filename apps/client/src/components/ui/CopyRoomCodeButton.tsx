import { useEffect, useRef, useState } from 'react';
import './copy-room-code.css';

export function CopyRoomCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { generation.current++; if (timer.current !== undefined) clearTimeout(timer.current); }, []);
  return <button type="button" className="small copy-room-code" aria-label="คัดลอกรหัส" title={copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'} onClick={async () => {
    const request = ++generation.current;
    if (timer.current !== undefined) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      if (request !== generation.current) return;
      setCopied(true);
      timer.current = setTimeout(() => { timer.current = undefined; setCopied(false); }, 1800);
    } catch { if (request === generation.current) setCopied(false); }
  }}>
    <svg className="copy-room-code-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {copied ? <path d="m5 12 4 4L19 6"/> : <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M15 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/></>}
    </svg>
    <span className="copy-room-code-label">{copied ? 'คัดลอกแล้ว' : 'คัดลอกรหัส'}</span>
    <span className="sr-only" role="status">{copied ? 'คัดลอกรหัสแล้ว' : ''}</span>
  </button>;
}
