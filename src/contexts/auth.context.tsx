'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthState } from '@/lib/types';
import { getCurrentUser, isAuthenticated, login as loginApi, logout as logoutApi } from '@/lib/api/auth.service';
import { loadTokensFromStorage } from '@/lib/api/client';
import { clearDatabase } from '@/lib/db/database';

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
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
  }, []);

  const logout = useCallback(async () => {
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
