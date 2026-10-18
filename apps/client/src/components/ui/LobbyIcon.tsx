const paths={
  people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  settings:'m9 3-.5 2-2 1-2-.5-2 3L4 10v3l-1.5 1.5 2 3 2-.5 2 1L9 21h4l.5-2 2-1 2 .5 2-3L18 13v-3l1.5-1.5-2-3-2 .5-2-1L13 3ZM14 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  book:'M12 5v16M12 5C8 2 3 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-1-1-6-2-10 1Z',
  word:'M7 7h10M7 12h10M7 17h6M4 2h16v20H4Z',
  chat:'M21 11a9 9 0 0 1-9 9H7l-5 3 2-6a9 9 0 1 1 17-6ZM8 11h.01M12 11h.01M16 11h.01',
  vote:'M8 4h8v10H8ZM5 11H3l-2 5v6h22v-6l-2-5h-2M2 16h20M10 8l2 2 3-3',
  crown:'m2 6 5 4 5-7 5 7 5-4-3 14H5ZM5 16h14',
  clock:'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
  check:'m5 12 4 4L19 6',
  play:'m7 3 14 9-14 9Z',
} as const;

export function LobbyIcon({name}:{name:keyof typeof paths}) {
  return <svg className="lobby-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
