import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "./apiClient";
import { getAuthToken, getAuthUser, setAuthToken, setAuthUser, clearAuth } from "./authUtils";

interface User {
  id: string;
  ename: string;
  name?: string;
  handle?: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  isVerified: boolean;
  isPrivate: boolean;
  email?: string;
  emailVerified?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (ename: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getAuthToken();
      const storedUser = getAuthUser();

      if (token && storedUser) {
        try {
          const response = await apiClient.get("/api/users/me");
          setUser(response.data);
          setAuthUser(response.data);
        } catch (error) {
          console.error("Failed to get current user:", error);
          clearAuth();
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (ename: string) => {
    try {
      const response = await apiClient.post("/api/auth", { ename });
      const { token, user: userData } = response.data;
      
      setAuthToken(token);
      setAuthUser(userData);
      setUser(userData);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
