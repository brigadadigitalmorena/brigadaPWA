'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Lock, User } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { updateProfile, uploadAvatar } from '@/lib/api/auth.service';
import { getApiErrorMessage } from '@/lib/utils/api-errors';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(
    user ? `${user.nombre} ${user.apellido}`.trim() : ''
  );
  const [phone, setPhone] = useState(user?.telefono ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const next = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
      });
      setUser(next);
      toast.success('Perfil actualizado');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo guardar el perfil.'));
    } finally {
      setSaving(false);
    }
  };

  const handleAvatar = async (file: File) => {
    setUploading(true);
    try {
      const next = await uploadAvatar(file);
      setUser(next);
      toast.success('Foto de perfil actualizada');
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'No se pudo subir la foto.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Perfil" description="Tu información en Brigada Digital" />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Foto y datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
              {user?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatar_url}
                  alt="Foto de perfil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-7 w-7" />
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleAvatar(file);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="h-4 w-4" />
                {uploading ? 'Subiendo…' : 'Cambiar foto'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profile-name">Nombre completo</Label>
            <Input
              id="profile-name"
              inputSize="mobile"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
              inputSize="mobile"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
            />
          </div>
          <div className="space-y-2">
            <Label>Correo</Label>
            <Input inputSize="mobile" value={user?.email ?? ''} disabled />
          </div>
          <Button type="button" size="mobile" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>

      <Link href="/profile/password" className="block">
        <Button variant="outline" size="mobile" className="w-full justify-start gap-3">
          <Lock className="h-5 w-5" />
          Cambiar contraseña
        </Button>
      </Link>
    </div>
  );
}
