import { create } from 'zustand';
import { apiClient, setAuthToken, removeAuthToken, removeAuthId, getAuthToken } from './apiClient';

interface User {
  id: string;
  ename: string;
  isVerified: boolean;
  isPrivate: boolean;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  initializeAuth: () => void;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  user: null,
  token: null,

  initializeAuth: () => {
    const token = getAuthToken();
    if (token) {
      // Set the token in axios headers
      apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Try to get current user
      apiClient.get('/api/users/me')
        .then(response => {
          set({ 
            isAuthenticated: true, 
            user: response.data,
            token 
          });
        })
        .catch(() => {
          // Token is invalid, remove it
          removeAuthToken();
          removeAuthId();
          set({ isAuthenticated: false, user: null, token: null });
        });
    }
  },

  login: (token: string, user: User) => {
    setAuthToken(token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ isAuthenticated: true, user, token });
  },

  logout: () => {
    removeAuthToken();
    removeAuthId();
    delete apiClient.defaults.headers.common['Authorization'];
    set({ isAuthenticated: false, user: null, token: null });
  },
})); 