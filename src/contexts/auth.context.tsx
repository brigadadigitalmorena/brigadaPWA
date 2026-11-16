'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { AuthState, User } from '@/lib/types';
import {
  getCurrentUser,
  isAuthenticated,
  login as loginApi,
  logout as logoutApi,
  persistUser,
  refreshUser as refreshUserApi,
} from '@/lib/api/auth.service';
import {
  clearTokensFromStorage,
  loadTokensFromStorage,
  saveTokensToStorage,
} from '@/lib/api/client';
import { clearDatabase, db } from '@/lib/db/database';
import { fieldSessionService } from '@/lib/services/field-session.service';
import { processSyncQueue } from '@/lib/services/sync-engine.service';
import { releaseSupportSession } from '@/lib/api/support.service';
import {
  normalizeSupportCapabilities,
  type SupportCapability,
} from '@/lib/support/access-policy';
import {
  clearSupportSession,
  readSupportSession,
  supportSurveyScopeKey,
  writeSupportSession,
  type StoredSupportSession,
} from '@/lib/support/session-storage';

export interface SupportJoinResult {
  access_token: string;
  session_id: string;
  helper_name: string;
  creator_name: string;
  creator_user_id?: number | null;
  allowed_capabilities?: string[];
  survey_ids?: number[] | null;
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  loginAsSupport: (join: SupportJoinResult) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  isSupport: boolean;
  supportSessionId: string | null;
  collectedByName: string | null;
  supportCreatorName: string | null;
  supportCapabilities: SupportCapability[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function supportLocalUserId(creatorUserId?: number | null): number {
  return typeof creatorUserId === 'number' && creatorUserId > 0
    ? creatorUserId
    : -1;
}

function buildSupportUser(session: StoredSupportSession): User {
  return {
    id: supportLocalUserId(session.creatorUserId),
    email: `support-${session.sessionId.slice(0, 8)}@brigada.local`,
    nombre: session.creatorName,
    apellido: `(Apoyo: ${session.helperName})`,
    role_key: 'helper',
    created_at: new Date().toISOString(),
    activo: true,
    permissions: ['submit_response', 'answer_surveys', 'view_surveys'],
    create_user_targets: [],
    allowed_survey_ids: [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });
  const [supportSession, setSupportSession] =
    useState<StoredSupportSession | null>(null);

  useEffect(() => {
    const initAuth = async () => {
      loadTokensFromStorage();
      const storedSupport = readSupportSession();

      if (storedSupport?.token) {
        saveTokensToStorage(storedSupport.token);
        const supportUser = buildSupportUser(storedSupport);
        persistUser(supportUser);
        setSupportSession(storedSupport);
        setState({
          user: supportUser,
          accessToken: storedSupport.token,
          refreshToken: null,
          isAuthenticated: true,
          isLoading: false,
        });
        return;
      }

      if (isAuthenticated()) {
        const user = getCurrentUser();
        setState({
          user,
          accessToken: localStorage.getItem('brigada_access_token'),
          refreshToken:
            sessionStorage.getItem('brigada_refresh_token') ||
            localStorage.getItem('brigada_refresh_token'),
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        setState((prev) => ({ ...prev, isLoading: false }));
      }
    };

    void initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      clearSupportSession();
      setSupportSession(null);
      const response = await loginApi({ username, password });

      setState({
        user: response.user,
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        isAuthenticated: true,
        isLoading: false,
      });

      void import('@/lib/services/datasets.service').then((m) =>
        m.warmDatasetsIfOnline()
      );
      void import('@/lib/services/static-maps-sync.service').then((m) =>
        m.syncStaticMaps()
      );
      void import('@/lib/api/tiles.service')
        .then((m) => m.getOsmTileManifest())
        .catch(() => undefined);
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const loginAsSupport = useCallback(async (join: SupportJoinResult) => {
    const sessionData: StoredSupportSession = {
      token: join.access_token,
      sessionId: join.session_id,
      helperName: join.helper_name,
      creatorName: join.creator_name,
      creatorUserId: join.creator_user_id ?? null,
      allowedCapabilities: normalizeSupportCapabilities(
        join.allowed_capabilities
      ),
      surveyScopeKey: supportSurveyScopeKey(join.survey_ids),
    };
    const supportUser = buildSupportUser(sessionData);

    clearTokensFromStorage();
    clearSupportSession();
    try {
      await clearDatabase();
    } catch {
      // Local wipe is best-effort before helper takeover.
    }

    saveTokensToStorage(join.access_token);
    writeSupportSession(sessionData);
    persistUser(supportUser);
    setSupportSession(sessionData);
    setState({
      user: supportUser,
      accessToken: join.access_token,
      refreshToken: null,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(async () => {
    const wasSupport = Boolean(readSupportSession());
    if (wasSupport) {
      await releaseSupportSession();
    }

    const activeFieldSession = await fieldSessionService.getActiveSession();
    if (activeFieldSession) {
      await fieldSessionService.endSession('logout');
    }

    const pendingRouteSamples = await db.field_session_samples
      .where('upload_status')
      .equals('pending')
      .count();
    if (pendingRouteSamples > 0) {
      if (typeof navigator === 'undefined' || !navigator.onLine) {
        throw new Error(
          'Hay puntos del recorrido sin enviar. Conéctate a internet antes de cerrar sesión.'
        );
      }
      await processSyncQueue();
    }

    const unsyncedRouteWork = await db.sync_queue
      .filter(
        (item) =>
          item.entity_type === 'field_session' &&
          item.status !== 'completed' &&
          item.status !== 'discarded'
      )
      .count();
    const remainingSamples = await db.field_session_samples
      .where('upload_status')
      .equals('pending')
      .count();
    if (unsyncedRouteWork > 0 || remainingSamples > 0) {
      throw new Error(
        'No se pudo respaldar el recorrido. Reintenta la sincronización antes de cerrar sesión.'
      );
    }

    try {
      if (!wasSupport) {
        await logoutApi();
      }
    } finally {
      clearSupportSession();
      setSupportSession(null);
      try {
        await clearDatabase();
      } catch (err) {
        console.warn('Failed to clear IndexedDB on logout', err);
      }
      clearTokensFromStorage();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('brigada_user');
      }
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  const refreshUser = useCallback(async () => {
    if (readSupportSession()) return;
    const user = await refreshUserApi();
    if (user) {
      setState((prev) => ({ ...prev, user }));
    }
  }, []);

  const setUser = useCallback((user: User) => {
    persistUser(user);
    setState((prev) => ({ ...prev, user }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginAsSupport,
        logout,
        refreshUser,
        setUser,
        isSupport: Boolean(supportSession),
        supportSessionId: supportSession?.sessionId ?? null,
        collectedByName: supportSession?.helperName ?? null,
        supportCreatorName: supportSession?.creatorName ?? null,
        supportCapabilities: supportSession?.allowedCapabilities ?? [],
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
