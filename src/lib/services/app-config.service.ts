/**
 * App-config module gates (online/offline) — portable subset from mobile.
 */

export type ModuleKey =
  | 'surveys'
  | 'sync'
  | 'tracking'
  | 'extras'
  | 'drafts'
  | 'maps'
  | 'notifications'
  | 'networks';

export interface AppConfigModules {
  onlineEnabledModules: ModuleKey[];
  offlineEnabledModules: ModuleKey[];
}

const DEFAULT_CONFIG: AppConfigModules = {
  onlineEnabledModules: [
    'surveys',
    'sync',
    'tracking',
    'extras',
    'drafts',
    'notifications',
  ],
  offlineEnabledModules: ['surveys', 'sync', 'drafts', 'extras'],
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
