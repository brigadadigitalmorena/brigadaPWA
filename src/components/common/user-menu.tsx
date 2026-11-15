'use client';

import { useState } from 'react';
import {
  LogOut,
  Moon,
  Sun,
  User,
  LifeBuoy,
  Handshake,
  Share2,
  Bug,
  Palette,
  X,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/theme-context';
import { User as UserType } from '@/lib/types';
import { UserAvatar } from '@/components/common/user-avatar';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';

interface UserMenuProps {
  user: UserType | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const { logout, isSupport } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Cerrar sesión',
      description: '¿Estás seguro de que deseas cerrar sesión?',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar',
      variant: 'warning',
    });

    if (!confirmed) return;

    setIsOpen(false);
    try {
      await logout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo cerrar la sesión.'
      );
    }
  };

  const goTo = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const displayName = user
    ? `${user.nombre} ${user.apellido}`.trim() || user.email
    : 'Usuario';

  const links = (
    [
      { href: '/settings/theme', label: 'Apariencia', Icon: Palette },
      { href: '/help', label: 'Ayuda', Icon: LifeBuoy },
      ...(!isSupport
        ? [{ href: '/support', label: 'Modo Apoyo', Icon: Handshake }]
        : []),
      { href: '/networks', label: 'Redes', Icon: Share2 },
      { href: '/report', label: 'Reportar un error', Icon: Bug },
      { href: '/debug', label: 'Diagnóstico', Icon: Bug },
    ] as Array<{
      href: string;
      label: string;
      Icon: typeof Palette;
    }>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="touch-target rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Abrir menú de usuario"
      >
        <UserAvatar
          name={displayName}
          avatarUrl={user?.avatar_url}
          size="sm"
        />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[min(92dvh,36rem)] w-[min(100%-1.5rem,24rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-sm"
        >
          <div className="sticky top-0 z-10 shrink-0 border-b bg-popover px-4 pb-3 pt-4">
            <div className="flex items-start gap-3 pr-10">
              <UserAvatar
                name={displayName}
                avatarUrl={user?.avatar_url}
                size="md"
              />
              <DialogHeader className="min-w-0 flex-1 gap-1 text-left">
                <DialogTitle className="truncate">{displayName}</DialogTitle>
                <DialogDescription className="truncate">
                  {user?.email ?? 'Brigadista'}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-2 top-2"
                  aria-label="Cerrar menú"
                />
              }
            >
              <X className="h-4 w-4" />
            </DialogClose>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3">
            <Button
              variant="outline"
              size="mobile"
              className="w-full justify-start gap-3"
              onClick={toggleTheme}
              disabled={!mounted}
            >
              {theme === 'light' ? (
                <Moon className="h-5 w-5 shrink-0" />
              ) : (
                <Sun className="h-5 w-5 shrink-0" />
              )}
              {theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
            </Button>

            <Button
              variant="outline"
              size="mobile"
              className="w-full justify-start gap-3"
              onClick={() => goTo('/profile')}
            >
              <User className="h-5 w-5 shrink-0" />
              Perfil y contraseña
            </Button>

            {links.map(({ href, label, Icon }) => (
              <Button
                key={href}
                variant="outline"
                size="mobile"
                className="w-full justify-start gap-3"
                onClick={() => goTo(href)}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {label}
              </Button>
            ))}
          </div>

          <div className="shrink-0 space-y-2 border-t bg-popover px-4 py-3 safe-area-bottom">
            <Button
              variant="outline"
              size="mobile"
              className="w-full justify-start gap-3 text-destructive hover:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-5 w-5 shrink-0" />
              Cerrar sesión
            </Button>
            <Button
              variant="secondary"
              size="mobile"
              className="w-full"
              onClick={() => setIsOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </>
  );
}
