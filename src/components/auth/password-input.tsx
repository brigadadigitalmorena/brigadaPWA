'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoComplete?: string;
  inputSize?: 'default' | 'mobile';
  className?: string;
}

export function PasswordInput({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  disabled = false,
  autoComplete,
  inputSize = 'mobile',
  className,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={showPassword ? 'text' : 'password'}
        inputSize={inputSize}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete={autoComplete}
        className={cn('pr-12', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => setShowPassword((visible) => !visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={showPassword}
        disabled={disabled}
      >
        {showPassword ? (
          <EyeOff className="h-5 w-5" />
        ) : (
          <Eye className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
