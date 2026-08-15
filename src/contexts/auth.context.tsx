'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthState } from '@/lib/types';
import { getCurrentUser, isAuthenticated, login as loginApi, logout as logoutApi } from '@/lib/api/auth.service';
import { loadTokensFromStorage } from '@/lib/api/client';
import { clearDatabase, db } from '@/lib/db/database';
import { fieldSessionService } from '@/lib/services/field-session.service';
import { processSyncQueue } from '@/lib/services/sync-engine.service';

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      loadTokensFromStorage();
      
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

    initAuth();
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
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
        .catch(() => {
          // Optional warm-up; maps remain usable without a published tile pack.
        });
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
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
      await logoutApi();
    } finally {
      try {
        await clearDatabase();
      } catch (err) {
        console.warn('Failed to clear IndexedDB on logout', err);
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
    const user = getCurrentUser();
    if (user) {
      setState((prev) => ({ ...prev, user }));
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshUser,
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
