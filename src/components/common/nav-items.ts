import {
  ClipboardList,
  FilePenLine,
  ListChecks,
  MapPinned,
  Route,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { EnviosIcon } from '@/components/common/icons/envios-icon';
import {
  isModuleEnabled,
  type ModuleKey,
} from '@/lib/services/app-config.service';

export type NavPlacement = 'primary' | 'more';
export type SidebarGroupId = 'trabajo' | 'campo' | 'sincronizacion';

export interface NavItem {
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  module: ModuleKey;
  isActive: (path: string) => boolean;
  placement: NavPlacement;
  sidebarGroup: SidebarGroupId;
  description: string;
  badge?: 'drafts';
}

export const SIDEBAR_GROUPS: Array<{ id: SidebarGroupId; label: string }> = [
  { id: 'trabajo', label: 'Trabajo' },
  { id: 'campo', label: 'Campo' },
  { id: 'sincronizacion', label: 'Sincronización' },
];

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Encuestas',
    href: '/surveys',
    icon: ClipboardList,
    module: 'surveys',
    isActive: (path) => path.startsWith('/surveys'),
    placement: 'primary',
    sidebarGroup: 'trabajo',
    description: 'Tus encuestas asignadas',
  },
  {
    label: 'Borradores',
    href: '/drafts',
    icon: FilePenLine,
    module: 'drafts',
    isActive: (path) => path.startsWith('/drafts'),
    placement: 'more',
    sidebarGroup: 'trabajo',
    description: 'Continuar encuestas a medias',
    badge: 'drafts',
  },
  {
    label: 'Extras',
    href: '/extras',
    icon: Zap,
    module: 'extras',
    isActive: (path) => path.startsWith('/extras'),
    placement: 'more',
    sidebarGroup: 'trabajo',
    description: 'Encuestas urgentes o adicionales',
  },
  {
    label: 'Gestión',
    href: '/tracking',
    icon: ListChecks,
    module: 'tracking',
    isActive: (path) => path.startsWith('/tracking'),
    placement: 'primary',
    sidebarGroup: 'trabajo',
    description: 'Seguimiento de gestión',
  },
  {
    label: 'Mapas',
    href: '/maps',
    icon: MapPinned,
    module: 'maps',
    isActive: (path) => path.startsWith('/maps'),
    placement: 'more',
    sidebarGroup: 'campo',
    description: 'Mapas y tiles offline',
  },
  {
    label: 'Recorridos',
    href: '/recorridos',
    icon: Route,
    module: 'recorridos',
    isActive: (path) => path.startsWith('/recorridos'),
    placement: 'more',
    sidebarGroup: 'campo',
    description: 'Sesiones de campo',
  },
  {
    label: 'Mis envíos',
    shortLabel: 'Envíos',
    href: '/sync',
    icon: EnviosIcon,
    module: 'sync',
    isActive: (path) => path.startsWith('/sync'),
    placement: 'primary',
    sidebarGroup: 'sincronizacion',
    description: 'Estado de sincronización',
  },
];

const PRIMARY_ORDER = ['/surveys', '/tracking', '/sync'] as const;
const MORE_ORDER = ['/drafts', '/extras', '/maps', '/recorridos'] as const;

function sortByHref(items: NavItem[], order: readonly string[]): NavItem[] {
  return [...items].sort(
    (a, b) => order.indexOf(a.href) - order.indexOf(b.href)
  );
}

function enabledItems(isOnline: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isModuleEnabled(item.module, isOnline));
}

export function getPrimaryNavItems(isOnline: boolean): NavItem[] {
  return sortByHref(
    enabledItems(isOnline).filter((item) => item.placement === 'primary'),
    PRIMARY_ORDER
  );
}

export function getMoreNavItems(isOnline: boolean): NavItem[] {
  return sortByHref(
    enabledItems(isOnline).filter((item) => item.placement === 'more'),
    MORE_ORDER
  );
}

export function isMoreRouteActive(path: string, isOnline: boolean): boolean {
  return getMoreNavItems(isOnline).some((item) => item.isActive(path));
}

export function getSidebarNavGroups(
  isOnline: boolean
): Array<{ id: SidebarGroupId; label: string; items: NavItem[] }> {
  const items = enabledItems(isOnline);
  return SIDEBAR_GROUPS.map((group) => ({
    ...group,
    items: items.filter((item) => item.sidebarGroup === group.id),
  })).filter((group) => group.items.length > 0);
}
