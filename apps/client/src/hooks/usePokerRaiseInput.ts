import { useCallback, useState } from 'react';
import type { ChangeEvent } from 'react';

/** Editing text can be empty; only the derived amount is used in action payloads. */
export function usePokerRaiseInput(initialAmount = 40) {
  const [value, setValue] = useState(String(initialAmount));
  const setAmount = useCallback((amount: number) => setValue(String(amount)), []);
  const onChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.currentTarget.value;
    if (!/^\d*$/.test(raw)) {
      event.currentTarget.value = value;
      return;
    }
    const normalized = raw.replace(/^0+(?=\d)/, '');
    // Normalize the DOM too when a paste resolves to the existing React state.
    event.currentTarget.value = normalized;
    setValue(normalized);
  }, [value]);
  return { value, amount: Number(value), setAmount, onChange };
}
