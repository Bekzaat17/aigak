import { useEffect, useState } from 'react';
export function useDrawer() {
  const [drawer, setDrawer] = useState<'history' | 'templates' | 'help' | null>(null);
  useEffect(() => {
    if (!drawer) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = document.querySelector<HTMLElement>('.drawer');
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawer(null);
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const controls = [
        ...panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select,textarea,[tabindex="0"]',
        ),
      ].filter((e) => e.getClientRects().length);
      const first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [drawer]);
  return { drawer, setDrawer };
}
