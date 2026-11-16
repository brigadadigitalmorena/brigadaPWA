'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Handshake, Loader2 } from 'lucide-react';
import { AuthShell } from '@/components/auth/auth-shell';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth.context';
import { getDeviceId } from '@/lib/api/auth.service';
import { joinSupportSession } from '@/lib/api/support.service';
import { parseSupportQr } from '@/lib/support/support-qr';
import { toast } from 'sonner';

export default function SupportJoinPage() {
  const router = useRouter();
  const { loginAsSupport } = useAuth();
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const submit = useCallback(
    async (fullCode: string) => {
      setLoading(true);
      setError(null);
      try {
        const deviceId = getDeviceId();
        const result = await joinSupportSession(fullCode, deviceId, {
          platform: 'web',
          userAgent: navigator.userAgent,
        });
        await loginAsSupport(result);
        toast.success(`Unido como ${result.helper_name}`);
        router.replace('/home');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Código inválido');
        setDigits(['', '', '', '', '', '']);
        refs.current[0]?.focus();
      } finally {
        setLoading(false);
      }
    },
    [loginAsSupport, router]
  );

  const onDigit = (text: string, index: number) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    setError(null);
    if (digit && index < 5) refs.current[index + 1]?.focus();
    if (digit && index === 5) {
      const full = next.join('');
      if (full.length === 6) void submit(full);
    }
  };

  const pasteCode = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const code = parseSupportQr(text);
      if (!code) {
        toast.error('Pega un código de 6 dígitos o el QR de Modo Apoyo');
        return;
      }
      setDigits(code.split(''));
      void submit(code);
    } catch {
      toast.error('No se pudo leer el portapapeles');
    }
  };

  return (
    <AuthShell>
      <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border bg-card p-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <Handshake className="h-12 w-12 text-primary" />
          <h1 className="text-xl font-semibold">Unirse como Helper</h1>
          <p className="text-sm text-muted-foreground">
            Escanea o ingresa el código de 6 dígitos que te muestra el brigadista
          </p>
        </div>

        <div className="flex justify-center gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                refs.current[index] = el;
              }}
              className="h-12 w-10 rounded-lg border bg-background text-center text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              disabled={loading}
              onChange={(event) => onDigit(event.target.value, index)}
              onKeyDown={(event) => {
                if (event.key === 'Backspace' && !digits[index] && index > 0) {
                  refs.current[index - 1]?.focus();
                }
              }}
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => void pasteCode()}
            disabled={loading}
          >
            Pegar código / QR
          </Button>
          {loading && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Verificando código…
            </p>
          )}
        </div>

        <p className="text-center text-sm">
          <Link href="/login" className="text-primary hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
