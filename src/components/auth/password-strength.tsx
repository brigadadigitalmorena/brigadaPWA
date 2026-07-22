'use client';

import { useMemo } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface PasswordChecks {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export interface PasswordStrength {
  score: number;
  label: string;
  barColor: string;
}

export function calcPasswordChecks(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function calcPasswordStrength(checks: PasswordChecks): PasswordStrength {
  const score = Object.values(checks).filter(Boolean).length;

  if (score === 0) return { score: 0, label: '', barColor: '' };
  if (score <= 2) return { score: 1, label: 'Muy débil', barColor: 'bg-red-500' };
  if (score === 3) return { score: 2, label: 'Débil', barColor: 'bg-orange-500' };
  if (score === 4) return { score: 3, label: 'Buena', barColor: 'bg-yellow-500' };
  return { score: 5, label: 'Fuerte', barColor: 'bg-emerald-500' };
}

const RULES: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'minLength', label: '8 caracteres mínimo' },
  { key: 'hasUpper', label: 'Una letra mayúscula' },
  { key: 'hasLower', label: 'Una letra minúscula' },
  { key: 'hasNumber', label: 'Un número' },
  { key: 'hasSpecial', label: 'Un carácter especial' },
];

interface PasswordStrengthCheckerProps {
  password: string;
  active?: boolean;
  className?: string;
}

export function PasswordStrengthChecker({
  password,
  active = password.length > 0,
  className = '',
}: PasswordStrengthCheckerProps) {
  const checks = useMemo(() => calcPasswordChecks(password), [password]);
  const strength = useMemo(() => calcPasswordStrength(checks), [checks]);

  if (!active) return null;

  const barSegments = 5;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Fortaleza de contraseña</span>
          {strength.label && (
            <span
              className={`font-semibold transition-colors ${
                strength.score >= 5
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : strength.score === 3
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : strength.score === 2
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-red-600 dark:text-red-400'
              }`}
            >
              {strength.label}
            </span>
          )}
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${barSegments}, 1fr)` }}
        >
          {Array.from({ length: barSegments }).map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index < strength.score
                  ? strength.barColor
                  : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
        {RULES.map(({ key, label }) => {
          const passed = checks[key];
          return (
            <p
              key={key}
              className={`flex items-center gap-1.5 transition-colors ${
                passed
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-muted-foreground'
              }`}
            >
              {passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 shrink-0" />
              )}
              {label}
            </p>
          );
        })}
      </div>
    </div>
  );
}
