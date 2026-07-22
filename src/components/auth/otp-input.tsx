'use client';

import { ClipboardEvent, KeyboardEvent, useRef } from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  digits: string[];
  onDigitsChange: (digits: string[]) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  isValidating?: boolean;
}

export function OtpInput({
  digits,
  onDigitsChange,
  onComplete,
  disabled = false,
  isValidating = false,
}: OtpInputProps) {
  const digitRefs = useRef<(HTMLInputElement | null)[]>(Array(6).fill(null));

  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    onDigitsChange(next);

    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus();
    }

    if (next.every(Boolean)) {
      onComplete(next.join(''));
    }
  };

  const handleDigitKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (event: ClipboardEvent) => {
    const pasted = event.clipboardData
      .getData('text')
      .replace(/[^0-9]/g, '')
      .slice(0, 6);

    if (pasted.length > 0) {
      const next = Array(6).fill('') as string[];
      for (let index = 0; index < pasted.length; index += 1) {
        next[index] = pasted[index];
      }
      onDigitsChange(next);
      const focusIndex = Math.min(pasted.length, 5);
      digitRefs.current[focusIndex]?.focus();
      if (pasted.length === 6) {
        onComplete(pasted);
      }
    }

    event.preventDefault();
  };

  if (isValidating) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        Verificando…
      </div>
    );
  }

  return (
    <div className="flex justify-center gap-2" onPaste={handleDigitPaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            digitRefs.current[index] = element;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(event) => handleDigitChange(index, event.target.value)}
          onKeyDown={(event) => handleDigitKeyDown(index, event)}
          disabled={disabled}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          className={cn(
            'h-12 w-11 rounded-xl border border-border bg-card text-center font-mono text-lg font-semibold text-foreground shadow-sm transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60'
          )}
          aria-label={`Dígito ${index + 1}`}
        />
      ))}
    </div>
  );
}
