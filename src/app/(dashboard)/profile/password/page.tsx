'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { changePassword } from '@/lib/api/auth.service';
import { getApiErrorMessage } from '@/lib/utils/api-errors';
import { calcPasswordChecks, PasswordStrengthChecker } from '@/components/auth/password-strength';
import { PasswordInput } from '@/components/auth/password-input';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const checks = calcPasswordChecks(newPassword);
  const strongEnough = checks.minLength && checks.hasUpper && checks.hasLower && checks.hasNumber;

  const handleSubmit = async () => {
    if (!strongEnough) {
      toast.error('La nueva contraseña no cumple los requisitos.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword === currentPassword) {
      toast.error('La nueva contraseña debe ser distinta a la actual.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('Contraseña actualizada. Vuelve a iniciar sesión.');
      await logout();
      router.replace('/login');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo cambiar la contraseña.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cambiar contraseña"
        description="Después de cambiarla tendrás que iniciar sesión de nuevo"
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <PasswordInput
              id="current-password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Nueva contraseña</Label>
            <PasswordInput
              id="new-password"
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordStrengthChecker password={newPassword} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar contraseña</Label>
            <PasswordInput
              id="confirm-password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
          </div>
          <Button type="button" size="mobile" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Actualizar contraseña'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
