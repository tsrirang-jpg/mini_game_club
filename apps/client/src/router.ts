export function navigate(path: string, replace = false) {
  if (location.pathname + location.search === path) return;
  history[replace ? 'replaceState' : 'pushState'](null, '', path);
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo(0, 0);
}
export const subscribeRoute = (listener: () => void) => {
  window.addEventListener('popstate', listener);
  return () => window.removeEventListener('popstate', listener);
};
export const getRoute = () => location.pathname + location.search;
