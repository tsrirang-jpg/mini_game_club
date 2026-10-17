import { useEffect, useRef, useState } from 'react';

export function CopyRoomCodeButton({ code, label = 'คัดลอก', copiedLabel = '✓', ariaLabel = 'คัดลอกรหัสห้อง' }: { code: string; label?: string; copiedLabel?: string; ariaLabel?: string }) {
  const [copied, setCopied] = useState(false);
  const generation = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { generation.current++; if (timer.current !== undefined) clearTimeout(timer.current); }, []);
  return <button className="small" aria-label={ariaLabel} onClick={async () => {
    const request = ++generation.current;
    if (timer.current !== undefined) clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      if (request !== generation.current) return;
      setCopied(true);
      timer.current = setTimeout(() => { timer.current = undefined; setCopied(false); }, 1800);
    } catch { if (request === generation.current) setCopied(false); }
  }}>{copied ? copiedLabel : label}</button>;
}
