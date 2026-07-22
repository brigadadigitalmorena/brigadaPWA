'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ClipboardList, Loader2 } from 'lucide-react';
import { isAxiosError } from 'axios';
import { useAuth } from '@/contexts/auth.context';
import { AuthShell } from '@/components/auth/auth-shell';
import { PasswordInput } from '@/components/auth/password-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const loginSchema = z.object({
  username: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function getLoginErrorMessage(error: unknown): string {
  if (isAxiosError(error)) {
    const code = error.response?.data?.code;
    if (error.response?.status === 403 && code === 'email_not_verified') {
      return 'Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.';
    }
    if (error.response?.status === 401) {
      return 'Credenciales incorrectas. Por favor, intenta de nuevo.';
    }
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
  }

  return 'Credenciales incorrectas. Por favor, intenta de nuevo.';
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

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

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      await login(data.username, data.password);
      toast.success('Inicio de sesión exitoso');
      router.push('/surveys');
    } catch (error) {
      console.error('Login error:', error);
      toast.error(getLoginErrorMessage(error));
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
        <CardContent className="pt-6">
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

          <div className="mt-6 space-y-3 text-center text-sm">
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
