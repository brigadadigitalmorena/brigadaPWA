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
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  user: UserType | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();
  const { logout, isSupport } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  const closeMenu = () => setIsOpen(false);

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: 'Cerrar sesión',
      description: '¿Estás seguro de que deseas cerrar sesión?',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar',
      variant: 'warning',
    });

    if (!confirmed) return;

    closeMenu();
    try {
      await logout();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo cerrar la sesión.'
      );
    }
  };

  const goTo = (href: string) => {
    closeMenu();
    // Defer navigation so the dialog unmounts before the route change on mobile.
    window.setTimeout(() => {
      router.push(href);
    }, 0);
  };

  const displayName = user
    ? `${user.nombre} ${user.apellido}`.trim() || user.email
    : 'Usuario';

  const links = (
    [
      { href: '/profile', label: 'Perfil y contraseña', Icon: User },
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
          className={cn(
            // Mobile: bottom sheet that always keeps Cerrar in the thumb zone.
            '!left-0 !right-0 !top-auto !bottom-0 !translate-x-0 !translate-y-0',
            '!w-full !max-w-none rounded-b-none rounded-t-2xl',
            'flex max-h-[min(92dvh,40rem)] flex-col gap-0 overflow-hidden p-0',
            // Desktop / tablet: centered dialog.
            'sm:!left-1/2 sm:!right-auto sm:!top-1/2 sm:!bottom-auto',
            'sm:!-translate-x-1/2 sm:!-translate-y-1/2',
            'sm:!w-full sm:!max-w-sm sm:rounded-xl'
          )}
        >
          <div className="relative shrink-0 border-b bg-popover px-4 pb-3 pt-4">
            <div className="flex items-start gap-3 pr-12">
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-2 top-2 z-20 h-10 w-10"
              aria-label="Cerrar menú"
              onClick={closeMenu}
            >
              <X className="h-5 w-5" />
            </Button>
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

          <div className="shrink-0 space-y-2 border-t bg-popover px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              type="button"
              variant="secondary"
              size="mobile"
              className="w-full"
              onClick={closeMenu}
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
