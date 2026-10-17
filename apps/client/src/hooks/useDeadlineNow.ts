import { useEffect, useState } from 'react';

// Render the clock only while a visible page has a live deadline. The server is
// authoritative; returning to the tab reads wall time rather than missed ticks.
export function useDeadlineNow(deadline = 0) {
  const [stamp, setStamp] = useState(() => ({ deadline, now: Date.now() }));
  useEffect(() => {
    if (!deadline || deadline <= Date.now()) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      const now = Date.now();
      setStamp({ deadline, now });
      if (!document.hidden && now < deadline) timer = setTimeout(tick, Math.min(250, deadline - now));
    };
    const visibility = () => { if (document.hidden) { if (timer !== undefined) clearTimeout(timer); timer = undefined; } else tick(); };
    document.addEventListener('visibilitychange', visibility);
    if (!document.hidden) tick();
    return () => { if (timer !== undefined) clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [deadline]);
  return stamp.deadline === deadline ? stamp.now : Date.now();
}
