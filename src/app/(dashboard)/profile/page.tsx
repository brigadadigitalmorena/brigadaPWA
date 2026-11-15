'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth.context';
import { updateProfile, uploadAvatar } from '@/lib/api/auth.service';
import { getApiErrorMessage } from '@/lib/utils/api-errors';
import { PageHeader } from '@/components/common/page-header';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);
const MAX_BYTES = 5 * 1024 * 1024;

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [firstName, setFirstName] = useState(user?.nombre ?? '');
  const [lastName, setLastName] = useState(user?.apellido ?? '');
  const [phone, setPhone] = useState(user?.telefono ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.nombre ?? '');
    setLastName(user.apellido ?? '');
    setPhone(user.telefono ?? '');
  }, [user?.id, user?.nombre, user?.apellido, user?.telefono]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const clearPreview = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      toast.error('El nombre es obligatorio.');
      return;
    }
    if (!lastName.trim()) {
      toast.error('El apellido es obligatorio.');
      return;
    }
    setSaving(true);
    try {
      const next = await updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
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
    if (!ACCEPTED_TYPES.has(file.type)) {
      toast.error('Usa una imagen JPEG, PNG o WebP.');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error('La imagen no puede superar 5 MB.');
      return;
    }

    clearPreview();
    const localUrl = URL.createObjectURL(file);
    previewUrlRef.current = localUrl;
    setPreviewUrl(localUrl);
    setUploading(true);

    try {
      const next = await uploadAvatar(file);
      setUser(next);
      toast.success('Foto de perfil actualizada');
      // Keep the local preview until the remote URL paints; then drop it so
      // subsequent loads use the persisted avatar_url.
      if (next.avatar_url) {
        const remote = new Image();
        remote.onload = () => clearPreview();
        remote.onerror = () => {
          // Remote URL failed (CDN/R2). Keep local preview for this session.
        };
        remote.src = next.avatar_url;
      }
    } catch (error) {
      clearPreview();
      toast.error(getApiErrorMessage(error, 'No se pudo subir la foto.'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const displayName =
    `${firstName} ${lastName}`.trim() ||
    (user ? `${user.nombre} ${user.apellido}`.trim() : '') ||
    user?.email ||
    'Usuario';

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 sm:space-y-6">
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <PageHeader
          title="Perfil"
          description="Tu información en Brigada Digital"
          backHref="/home"
          backLabel="Volver al inicio"
          backVariant="button"
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Foto y datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <UserAvatar
              name={displayName}
              avatarUrl={user?.avatar_url}
              previewUrl={previewUrl}
              size="lg"
            />
            <div className="min-w-0 flex-1 space-y-1">
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
              <p className="text-xs text-muted-foreground">
                JPEG, PNG o WebP · máximo 5 MB
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="profile-first-name">Nombre</Label>
              <Input
                id="profile-first-name"
                inputSize="mobile"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="Tu nombre"
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-last-name">Apellidos</Label>
              <Input
                id="profile-last-name"
                inputSize="mobile"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Tus apellidos"
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-phone">Teléfono</Label>
            <Input
              id="profile-phone"
              inputSize="mobile"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              placeholder="Ej. 55 1234 5678"
              autoComplete="tel"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-email">Correo</Label>
            <Input
              id="profile-email"
              inputSize="mobile"
              value={user?.email ?? ''}
              disabled
              placeholder="correo@ejemplo.com"
            />
          </div>
          <Button
            type="button"
            size="mobile"
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </CardContent>
      </Card>

      <Link href="/profile/password" className="block">
        <Button
          variant="outline"
          size="mobile"
          className="w-full justify-start gap-3"
        >
          <Lock className="h-5 w-5 shrink-0" />
          Cambiar contraseña
        </Button>
      </Link>

      <Link href="/home" className="block pb-2">
        <Button variant="secondary" size="mobile" className="w-full">
          Cerrar perfil
        </Button>
      </Link>
    </div>
  );
}
