import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Option<T> { value: T; label: string; disabled?: boolean }
interface Props<T> { label: string; value: T; options: readonly Option<T>[]; onChange(value: T): void; disabled?: boolean; compact?: boolean }
interface Position { top: number; left: number; width: number; maxHeight: number; above: boolean }

export function SpyfallSelect<T extends string | number>({ label, value, options, onChange, disabled = false, compact = false }: Props<T>) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState('');
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const selected = options.findIndex(option => option.value === value);
  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled || disabled) return;
    if (option.value !== value) onChange(option.value);
    setOpen(false); triggerRef.current?.focus({ preventScroll: true });
  };
  const move = (from: number, direction: number) => {
    for (let step = 1; step <= options.length; step++) {
      const index = (from + direction * step + options.length * 2) % options.length;
      if (!options[index].disabled) return index;
    }
    return from;
  };
  const show = () => { setActive(selected >= 0 ? selected : move(-1, 1)); setOpen(true); };

  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const blur = (event: FocusEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', blur);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', blur); };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      const viewport = window.visualViewport;
      const leftEdge = (viewport?.offsetLeft ?? 0) + 12;
      const rightEdge = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth) - 12;
      const topEdge = (viewport?.offsetTop ?? 0) + 12;
      const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) - 12;
      const desired = options.length * 46 + 14;
      const below = bottomEdge - rect.bottom - 8;
      const aboveSpace = rect.top - topEdge - 8;
      const above = below < Math.min(desired, 160) && aboveSpace > below;
      const maxHeight = Math.max(46, Math.min(300, above ? aboveSpace : below));
      const width = Math.min(Math.max(rect.width, compact ? 150 : 0), rightEdge - leftEdge);
      const next = { width, left: Math.max(leftEdge, Math.min(rect.left, rightEdge - width)), maxHeight, above,
        top: above ? Math.max(topEdge, rect.top - 8 - Math.min(desired, maxHeight)) : rect.bottom + 8 };
      setPosition(old => old && Object.keys(next).every(key => old[key as keyof Position] === next[key as keyof Position]) ? old : next);
    };
    // The portal can live outside the game shell, so carry its theme with it.
    setTheme([...(triggerRef.current!.closest('.club-shell')?.classList ?? [])].find(name => name.startsWith('theme-')) ?? '');
    place(); window.addEventListener('resize', place); window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place); window.visualViewport?.addEventListener('scroll', place);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place); window.visualViewport?.removeEventListener('scroll', place); };
  }, [open, options.length, compact]);
  useEffect(() => { if (open) document.getElementById(`${id}-option-${active}`)?.scrollIntoView({ block: 'nearest' }); }, [open, active, id]);

  return <div className={`spy-select ${compact ? 'compact' : ''}`}>
    {!compact && <label id={`${id}-label`} htmlFor={`${id}-trigger`}>{label}</label>}
    <button ref={triggerRef} id={`${id}-trigger`} type="button" role="combobox" className="spy-select-trigger" disabled={disabled}
      aria-label={compact ? label : undefined} aria-labelledby={compact ? undefined : `${id}-label`}
      aria-expanded={open} aria-haspopup="listbox" aria-controls={open ? `${id}-menu` : undefined}
      aria-activedescendant={open ? `${id}-option-${active}` : undefined}
      onClick={() => { if (open) setOpen(false); else show(); }}
      onKeyDown={event => {
        if (disabled) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (!open) show(); else setActive(move(active, event.key === 'ArrowDown' ? 1 : -1));
        } else if (event.key === 'Home' || event.key === 'End') {
          event.preventDefault(); setOpen(true); setActive(move(event.key === 'Home' ? -1 : options.length, event.key === 'Home' ? 1 : -1));
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault(); if (open) choose(active); else show();
        } else if (event.key === 'Escape' && open) {
          event.preventDefault(); event.stopPropagation(); setOpen(false);
        } else if (event.key === 'Tab') setOpen(false);
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          const index = options.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));
          if (index >= 0) { event.preventDefault(); setActive(index); setOpen(true); }
        }
      }}>
      <span className="spy-select-value">{compact && <span className="spy-select-caption">{label}</span>}<strong>{options[selected]?.label ?? value}</strong></span>
      <svg className={open ? 'expanded' : ''} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
    {open && createPortal(<ul ref={menuRef} id={`${id}-menu`} role="listbox" aria-label={label} className={`spy-select-menu ${theme}`} data-placement={position?.above ? 'above' : 'below'}
      style={position ? { top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight } : { visibility: 'hidden' }}
      onMouseDown={event => event.preventDefault()}>
      {options.map((option, index) => <li key={option.value} id={`${id}-option-${index}`} role="option" aria-selected={option.value === value} aria-disabled={!!option.disabled}
        className={`${option.value === value ? 'is-selected' : ''} ${active === index ? 'is-active' : ''}`} onPointerMove={event => { if (event.pointerType === 'mouse' && !option.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span>{option.label}</span>{option.value === value && <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="m4 9 3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
      </li>)}
    </ul>, triggerRef.current?.closest('dialog') ?? document.body)}
  </div>;
}
