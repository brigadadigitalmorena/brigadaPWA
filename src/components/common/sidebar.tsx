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
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
  user: User | null;
  currentPath: string;
}

export function Sidebar({ user, currentPath }: SidebarProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuItems = [
    {
      label: 'Encuestas',
      href: '/surveys',
      icon: ClipboardList,
    },
    {
      label: 'Sincronización',
      href: '/sync',
      icon: RefreshCw,
    },
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-background border rounded-lg p-2 shadow-lg"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-64 bg-background border-r
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold">Brigada Digital</h2>
            {user && (
              <p className="text-sm text-muted-foreground mt-1">
                {user.nombre} {user.apellido}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href || 
                (item.href !== '/surveys' && currentPath.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-lg
                    transition-colors
                    ${isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                    }
                  `}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <Separator />

          {/* Footer */}
          <div className="p-4">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={handleLogout}
            >
              <LogOut size={20} />
              <span>Cerrar sesión</span>
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
