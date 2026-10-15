/**
 * App-config module gates (online/offline) — portable subset from mobile.
 */

export type ModuleKey =
  | 'home'
  | 'surveys'
  | 'sync'
  | 'tracking'
  | 'extras'
  | 'drafts'
  | 'maps'
  | 'recorridos'
  | 'notifications'
  | 'networks';

export interface AppConfigModules {
  onlineEnabledModules: ModuleKey[];
  offlineEnabledModules: ModuleKey[];
}

const DEFAULT_CONFIG: AppConfigModules = {
  onlineEnabledModules: [
    'home',
    'surveys',
    'sync',
    'tracking',
    'extras',
    'drafts',
    'maps',
    'recorridos',
    'notifications',
    'networks',
  ],
  offlineEnabledModules: [
    'home',
    'surveys',
    'sync',
    'drafts',
    'extras',
    'maps',
    'recorridos',
    'networks',
  ],
};

let cached: AppConfigModules = DEFAULT_CONFIG;

export function setAppConfigModules(partial: Partial<AppConfigModules>): void {
  cached = { ...cached, ...partial };
}

export function getAppConfigModules(): AppConfigModules {
  return cached;
}

export function isModuleEnabled(
  module: ModuleKey,
  isOnline: boolean
): boolean {
  const list = isOnline
    ? cached.onlineEnabledModules
    : cached.offlineEnabledModules;
  return list.includes(module);
}
