'use client';

import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/auth.context';
import { User as UserType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UserMenuProps {
  user: UserType | null;
}

export function UserMenu({ user }: UserMenuProps) {
  const { logout } = useAuth();
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
    await logout();
  };

  const initials = user
    ? `${user.nombre?.[0] ?? ''}${user.apellido?.[0] ?? ''}`.toUpperCase() || 'U'
    : 'U';

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm touch-target"
        aria-label="Abrir menú de usuario"
      >
        {initials}
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-6 w-6" />
              </div>
              <div className="text-left">
                <DialogTitle>
                  {user ? `${user.nombre} ${user.apellido}` : 'Usuario'}
                </DialogTitle>
                <DialogDescription>
                  {user?.email ?? 'Brigadista'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Button
            variant="outline"
            size="mobile"
            className="w-full justify-start gap-3"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            Cerrar sesión
          </Button>
        </DialogContent>
      </Dialog>

      {confirmDialog}
    </>
  );
}
