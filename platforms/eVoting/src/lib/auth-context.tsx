"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { apiClient } from "./apiClient";
import { getAuthToken, getAuthId, setAuthToken, setAuthId, clearAuth } from "./authUtils";

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
  
  // Debug logging
  console.log("Auth state - user:", user, "isAuthenticated:", isAuthenticated, "isLoading:", isLoading);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = getAuthToken();
      const userId = getAuthId();

      console.log("Auth initialization - Token:", !!token, "UserId:", userId);

      if (token && userId) {
        try {
          console.log("Fetching current user...");
          const response = await apiClient.get("/api/users/me");
          console.log("User data received:", response.data);
          setUser(response.data);
          console.log("User state set, isAuthenticated should be:", !!response.data);
        } catch (error) {
          console.error("Failed to get current user:", error);
          clearAuth();
        }
      } else {
        console.log("No stored credentials found");
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
      setAuthId(userData.id);
      setUser(userData);
    } catch (error) {
      console.error("Login failed:", error);
      throw error;
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
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