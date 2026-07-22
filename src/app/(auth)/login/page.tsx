'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineBanner } from '@/components/ui/inline-banner';
import { LoadingState } from '@/components/common/loading-state';
import { toast } from 'sonner';
import {
  getLoginErrorMessage,
  isEmailNotVerifiedError,
} from '@/lib/utils/api-errors';

const loginSchema = z.object({
  username: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [banner, setBanner] = useState<{
    variant: 'error' | 'warning' | 'info';
    message: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  useEffect(() => {
    if (searchParams.get('pending_email_verification') === '1') {
      const emailHint = searchParams.get('email_hint');
      setBanner({
        variant: 'info',
        message: emailHint
          ? `Cuenta creada correctamente. Revisa tu correo (${emailHint}), abre el enlace de verificación y luego vuelve a iniciar sesión.`
          : 'Cuenta creada correctamente. Revisa tu correo, abre el enlace de verificación y luego vuelve a iniciar sesión.',
      });
    }
  }, [searchParams]);

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setBanner(null);

    try {
      await login(data.username, data.password);
      toast.success('Inicio de sesión exitoso');
      router.push('/surveys');
    } catch (error) {
      console.error('Login error:', error);
      const message = getLoginErrorMessage(error);
      setBanner({
        variant: isEmailNotVerifiedError(error) ? 'warning' : 'error',
        message,
      });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell>
      <div className="text-center space-y-3">
        <div className="mx-auto w-20 h-20 bg-primary/10 rounded-2xl flex items-center justify-center">
          <ClipboardList className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Brigada Digital</h1>
          <p className="text-base text-muted-foreground mt-2">
            Inicia sesión para acceder a tus encuestas
          </p>
        </div>
      </div>

      <Card className="rounded-2xl shadow-lg border-primary/10">
        <CardHeader className="sr-only">
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>Formulario de acceso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {banner && (
            <InlineBanner
              variant={banner.variant}
              message={banner.message}
              onClose={() => setBanner(null)}
            />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base">
                Correo electrónico
              </Label>
              <Input
                id="username"
                type="email"
                inputSize="mobile"
                placeholder="tu@correo.com"
                autoComplete="email"
                disabled={isLoading}
                {...register('username')}
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">
                Contraseña
              </Label>
              <Controller
                name="password"
                control={control}
                render={({ field }) => (
                  <PasswordInput
                    id="password"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                )}
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>

            <Button type="submit" size="mobile" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </Button>
          </form>

          <div className="space-y-3 text-center text-sm">
            <p>
              <Link
                href="/activate"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                ¿Primera vez? Activa tu cuenta
              </Link>
            </p>
            <div className="text-muted-foreground space-y-1">
              <p>¿Olvidaste tu contraseña?</p>
              <p>Contacta al administrador del sistema</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <AuthShell>
          <LoadingState message="Cargando..." minHeight="min-h-[50vh]" />
        </AuthShell>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
