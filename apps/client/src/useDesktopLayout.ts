import { useSyncExternalStore } from 'react';

// The desktop composition begins above the phone landscape layouts.
const query = '(min-width: 1000px) and (min-height: 651px)';
const subscribe = (change: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', change);
  return () => media.removeEventListener('change', change);
};
const getSnapshot = () => window.matchMedia(query).matches;
export const useDesktopLayout = () => useSyncExternalStore(subscribe, getSnapshot, () => false);
