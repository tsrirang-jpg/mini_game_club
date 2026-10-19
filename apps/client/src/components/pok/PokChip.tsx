/** Decorative chip stack: role colors come from the surrounding player panel. */
export function PokChip() {
  return <svg className="pok-chip-stack" viewBox="0 0 48 40" aria-hidden="true">
    <g fill="var(--chip-color,#29b781)" stroke="#063323" strokeWidth="1">
      <path d="M3 23v7c0 5 9 9 20 9s20-4 20-9v-7Z"/>
      <ellipse cx="23" cy="23" rx="20" ry="8" stroke="#d7f5df" strokeWidth="4" strokeDasharray="8 9"/>
      <path d="M6 12v8c0 5 9 9 20 9s20-4 20-9v-8Z"/>
      <ellipse cx="26" cy="12" rx="20" ry="9" stroke="#e7ffec" strokeWidth="4" strokeDasharray="8 9"/>
      <ellipse cx="26" cy="12" rx="10" ry="4" fill="#e7ffec"/>
    </g>
  </svg>;
}
