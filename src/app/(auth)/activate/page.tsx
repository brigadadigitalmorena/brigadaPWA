'use client';

import Link from 'next/link';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { BadgeCheck, KeyRound, Loader2, Mail, RefreshCw } from 'lucide-react';

import { AuthShell } from '@/components/auth/auth-shell';
import { OtpInput } from '@/components/auth/otp-input';
import { PasswordInput } from '@/components/auth/password-input';
import {
  calcPasswordChecks,
  PasswordStrengthChecker,
} from '@/components/auth/password-strength';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { InlineBanner } from '@/components/ui/inline-banner';
import {
  completeActivation,
  resendActivationCode,
  validateActivationCode,
} from '@/lib/api/activation.service';
import {
  ACTIVATION_STATUS_VARIANT_CLASSES,
  getActivationStatusConfig,
  type ValidateActivationCodeResult,
} from '@/lib/utils/activation-messages';

const CODE_REGEX = /^\d{6}$/;

export default function ActivatePage() {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const code = digits.join('');

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const [validationResult, setValidationResult] =
    useState<ValidateActivationCodeResult | null>(null);

  const [isValidating, setIsValidating] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [emailHint, setEmailHint] = useState('');

  const statusConfig = useMemo(
    () => getActivationStatusConfig(validationResult),
    [validationResult]
  );

  const passwordChecks = useMemo(() => calcPasswordChecks(password), [password]);
  const passwordsMatch =
    passwordConfirm.length === 0 || password === passwordConfirm;
  const allChecksPass = Object.values(passwordChecks).every(Boolean);
  const step: 1 | 2 = validationResult?.valid ? 2 : 1;

  const runValidateCode = async (codeValue: string) => {
    setIsValidating(true);
    try {
      const result = await validateActivationCode(codeValue);
      setValidationResult(result);
      if (result.valid) {
        toast.success('Código validado correctamente');
      } else {
        toast.error(result.error || 'No se pudo validar el código');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleResendCode = async () => {
    if (!CODE_REGEX.test(code)) {
      toast.error('Ingresa un código de 6 dígitos para reenviar');
      return;
    }

    setIsResending(true);
    try {
      const result = await resendActivationCode(code);

      if (result.success && result.resent) {
        toast.success(result.message || 'Código reenviado correctamente');
        setValidationResult(null);
        setDigits(Array(6).fill(''));
      } else {
        toast.error(result.error || result.message || 'No se pudo reenviar el código');
      }
    } finally {
      setIsResending(false);
    }
  };

  const handleCompleteActivation = async (event: FormEvent) => {
    event.preventDefault();

    if (!validationResult?.valid) {
      toast.error('Primero valida un código de activación');
      return;
    }

    if (!allChecksPass) {
      toast.error('La contraseña no cumple con todos los requisitos');
      return;
    }

    if (password !== passwordConfirm) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (!agreeToTerms) {
      toast.error('Debes aceptar los términos para continuar');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await completeActivation({
        code,
        password,
        password_confirm: passwordConfirm,
        agree_to_terms: agreeToTerms,
      });

      if (result.success) {
        setEmailHint(result.email_hint);
        setIsCompleted(true);
        toast.success('Cuenta creada. Revisa tu correo para verificarla.');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        toast.error(result.message || 'No se pudo completar la activación');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      toast.error(message || 'Error al completar la activación');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell layout="top">
      <div className="space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
            <KeyRound className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activar cuenta</h1>
            <p className="mt-2 text-base text-muted-foreground">
              Ingresa el código que recibiste y crea tu contraseña
            </p>
          </div>
        </div>

        <Card className="rounded-2xl border-primary/10 shadow-lg">
          <CardHeader className="sr-only">
            <CardTitle>Activar cuenta</CardTitle>
            <CardDescription>Formulario de activación</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {isCompleted ? (
              <div className="space-y-5">
                <InlineBanner
                  variant="info"
                  message={
                    emailHint
                      ? `Te enviamos un correo a ${emailHint}. Ábrelo y haz clic en el enlace de verificación antes de iniciar sesión.`
                      : 'Te enviamos un correo de verificación. Ábrelo y confirma tu cuenta antes de iniciar sesión.'
                  }
                />

                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                    <BadgeCheck className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                  </span>
                  <div className="space-y-2">
                    <h2 className="text-lg font-semibold">¡Cuenta registrada!</h2>
                    <p className="text-sm text-muted-foreground">
                      Tu contraseña quedó guardada. El último paso es verificar tu correo
                      electrónico para poder entrar a la app.
                    </p>
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                      <Mail className="h-4 w-4 shrink-0 text-primary" />
                      <span>Revisa bandeja de entrada y carpeta de spam.</span>
                    </div>
                  </div>
                </div>

                <Button
                  size="mobile"
                  className="w-full"
                  render={
                    <Link
                      href={`/login?pending_email_verification=1${
                        emailHint ? `&email_hint=${encodeURIComponent(emailHint)}` : ''
                      }`}
                    />
                  }
                >
                  Ir a iniciar sesión
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-center gap-3 text-xs font-medium">
                  <span
                    className={`flex items-center gap-1.5 ${
                      step >= 1 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        step === 1
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      }`}
                    >
                      {step > 1 ? '✓' : '1'}
                    </span>
                    Verificar código
                  </span>
                  <div className="h-px w-8 bg-border" />
                  <span
                    className={`flex items-center gap-1.5 ${
                      step === 2 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        step === 2
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      2
                    </span>
                    Crear contraseña
                  </span>
                </div>

                <div className="space-y-2">
                  <Label className="text-base">Código de activación</Label>
                  <OtpInput
                    digits={digits}
                    onDigitsChange={setDigits}
                    onComplete={runValidateCode}
                    disabled={validationResult?.valid || isValidating}
                    isValidating={isValidating}
                  />
                </div>

                {statusConfig && (
                  <div
                    className={`rounded-xl border p-4 ${ACTIVATION_STATUS_VARIANT_CLASSES[statusConfig.variant]}`}
                  >
                    <p className="text-sm font-semibold">{statusConfig.title}</p>
                    <p className="mt-1 text-sm">{statusConfig.description}</p>
                  </div>
                )}

                {validationResult?.resend_available && !validationResult.valid && (
                  <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      Puedes solicitar un nuevo código a tu correo.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="mobile"
                      onClick={handleResendCode}
                      disabled={isResending}
                      className="w-full sm:w-auto"
                    >
                      {isResending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Reenviando…
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-4 w-4" />
                          Reenviar código
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {validationResult?.valid && (
                  <form onSubmit={handleCompleteActivation} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="password">Contraseña nueva</Label>
                      <PasswordInput
                        id="password"
                        value={password}
                        onChange={setPassword}
                        placeholder="Crea una contraseña segura"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      {password.length > 0 && (
                        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                          <PasswordStrengthChecker password={password} />
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="passwordConfirm">Confirmar contraseña</Label>
                      <PasswordInput
                        id="passwordConfirm"
                        value={passwordConfirm}
                        onChange={setPasswordConfirm}
                        placeholder="Repite tu contraseña"
                        disabled={isSubmitting}
                        autoComplete="new-password"
                      />
                      {!passwordsMatch && (
                        <p className="text-sm text-destructive">
                          Las contraseñas no coinciden
                        </p>
                      )}
                    </div>

                    <label className="flex cursor-pointer select-none items-start gap-3">
                      <Checkbox
                        checked={agreeToTerms}
                        onCheckedChange={(checked) => setAgreeToTerms(checked === true)}
                        disabled={isSubmitting}
                        aria-label="Aceptar términos y condiciones"
                        className="mt-0.5"
                      />
                      <span className="text-sm text-muted-foreground">
                        Acepto los términos y condiciones de uso.
                      </span>
                    </label>

                    <Button
                      type="submit"
                      size="mobile"
                      className="w-full"
                      disabled={
                        isSubmitting ||
                        !allChecksPass ||
                        !passwordsMatch ||
                        !agreeToTerms
                      }
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Activando…
                        </>
                      ) : (
                        'Activar mi cuenta'
                      )}
                    </Button>
                  </form>
                )}

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-sm text-primary underline-offset-2 hover:underline"
                  >
                    Volver a iniciar sesión
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthShell>
  );
}
