import { useSyncExternalStore } from 'react';

// A short desktop window (browser zoom, Windows scaling or DevTools) still
// uses the compact Clean Row composition. Touch-only phone/tablet layouts retain their existing rules.
const query = '(min-width: 1000px) and (min-height: 651px), (min-width: 900px) and (hover: hover) and (pointer: fine)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const getSnapshot = () => window.matchMedia(query).matches;
export const usePokerDesktopLayout = () => useSyncExternalStore(subscribe, getSnapshot, () => false);
