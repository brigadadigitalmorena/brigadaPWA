'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth.context';
import { User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList,
  RefreshCw,
  LogOut,
} from 'lucide-react';

interface SidebarProps {
  user: User | null;
  currentPath: string;
}

export function Sidebar({ user, currentPath }: SidebarProps) {
  const { logout } = useAuth();

  const menuItems = [
    {
      label: 'Encuestas',
      href: '/surveys',
      icon: ClipboardList,
      isActive: (path: string) => path.startsWith('/surveys'),
    },
    {
      label: 'Sincronización',
      href: '/sync',
      icon: RefreshCw,
      isActive: (path: string) => path.startsWith('/sync'),
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background">
      <div className="flex flex-col h-full">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold">Brigada Digital</h2>
          {user && (
            <p className="text-sm text-muted-foreground mt-1">
              {user.nombre} {user.apellido}
            </p>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.isActive(currentPath);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-base
                  transition-colors touch-target
                  ${isActive
                    ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                    : 'hover:bg-accent'
                  }
                `}
              >
                <Icon size={22} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Separator />

        <div className="p-4">
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3 h-12 text-base"
            onClick={handleLogout}
          >
            <LogOut size={22} />
            <span>Cerrar sesión</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
