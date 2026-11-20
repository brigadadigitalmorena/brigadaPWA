'use client';

import { useEffect, useState } from 'react';

export interface KeyboardViewport {
  /** Pixels covered by the on-screen keyboard. 0 when the layout already shrunk. */
  inset: number;
  /** Visible height in CSS pixels, or null before the first measurement. */
  height: number | null;
}

/**
 * Tracks the visible viewport so a screen can shrink with the keyboard
 * instead of keeping a 100vh box that hides the focused field.
 */
export function useKeyboardViewport(): KeyboardViewport {
  const [state, setState] = useState<KeyboardViewport>({ inset: 0, height: null });

  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight);
      const covered = viewport
        ? window.innerHeight - viewport.height - viewport.offsetTop
        : 0;
      const next = {
        height,
        inset: covered > 80 ? Math.round(covered) : 0,
      };
      setState((prev) =>
        prev.height === next.height && prev.inset === next.inset ? prev : next
      );
    };

    update();
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return state;
}

/** @deprecated Use useKeyboardViewport. Kept so existing callers stay valid. */
export function useKeyboardInset(): number {
  return useKeyboardViewport().inset;
}
