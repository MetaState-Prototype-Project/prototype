import { useState, useEffect } from 'react';
import { apiClient } from '../lib/apiClient';
import { setAuthToken, removeAuthToken, getAuthToken } from '../lib/authUtils';

interface User {
  id: string;
  ename: string;
  isVerified: boolean;
  isPrivate: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
  });

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    const token = getAuthToken();
    if (token) {
      try {
        const response = await apiClient.get('/api/users/me');
        setAuthState({
          isAuthenticated: true,
          user: response.data,
          loading: false,
        });
      } catch (error) {
        // Token is invalid, remove it
        removeAuthToken();
        setAuthState({
          isAuthenticated: false,
          user: null,
          loading: false,
        });
      }
    } else {
      setAuthState({
        isAuthenticated: false,
        user: null,
        loading: false,
      });
    }
  };

  const login = (token: string, user: User) => {
    setAuthToken(token);
    setAuthState({
      isAuthenticated: true,
      user,
      loading: false,
    });
  };

  const logout = () => {
    removeAuthToken();
    setAuthState({
      isAuthenticated: false,
      user: null,
      loading: false,
    });
  };

  return {
    ...authState,
    login,
    logout,
  };
}
