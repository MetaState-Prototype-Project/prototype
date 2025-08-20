"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/lib/apiClient";
import { getAuthToken, removeAuthToken, removeAuthId } from "@/lib/authUtils";
import LoginScreen from "./login-screen";

interface User {
  id: string;
  ename: string;
  name?: string;
  isVerified: boolean;
  isPrivate: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  logout: () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("AuthProvider: useEffect triggered");
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    console.log("AuthProvider: initializeAuth called");
    const token = getAuthToken();
    console.log("AuthProvider: token from localStorage:", token ? "exists" : "not found");
    
    if (!token) {
      console.log("AuthProvider: no token, setting loading to false");
      setIsLoading(false);
      return;
    }

    try {
      console.log("AuthProvider: making API call to /api/users/me");
      const response = await apiClient.get('/api/users/me');
      console.log("AuthProvider: API response:", response.data);
      setUser(response.data);
    } catch (error) {
      console.error("AuthProvider: API call failed:", error);
      // Token is invalid, remove it
      removeAuthToken();
      removeAuthId();
      setUser(null);
    } finally {
      console.log("AuthProvider: setting loading to false");
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    removeAuthId();
    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    logout,
  };

  console.log("AuthProvider: render state - isLoading:", isLoading, "user:", user ? "exists" : "null");

  if (isLoading) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex h-screen items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
        </div>
      </AuthContext.Provider>
    );
  }

  if (!user) {
    return (
      <AuthContext.Provider value={value}>
        <LoginScreen />
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
} 