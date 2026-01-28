import { writable } from "svelte/store";
import {
    apiClient,
    setAuthToken,
    removeAuthToken,
    removeAuthId,
} from "$lib/utils/axios";

export const isAuthenticated = writable(false);
export const currentUser = writable<any>(null);
export const authInitialized = writable(false);

export const initializeAuth = async () => {
    authInitialized.set(false);
    const token = localStorage.getItem("esigner_auth_token");
    if (token) {
        // Set token in axios headers immediately
        apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        // Verify token is still valid by fetching current user
        try {
            const response = await apiClient.get("/api/users");
            if (response.data) {
                currentUser.set(response.data);
                isAuthenticated.set(true);
                authInitialized.set(true);
                return true;
            }
        } catch (err) {
            // Token invalid, clear it
            console.error("Auth token invalid:", err);
            removeAuthToken();
            removeAuthId();
            delete apiClient.defaults.headers.common["Authorization"];
        }
    }
    isAuthenticated.set(false);
    currentUser.set(null);
    authInitialized.set(true);
    return false;
};

export const login = async (token: string, user?: any) => {
    // Store token in localStorage first
    setAuthToken(token);
    // Set token in axios headers
    apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    // Set user if provided
    if (user) {
        currentUser.set(user);
        isAuthenticated.set(true);
    }

    // Verify by fetching user to ensure token is valid
    try {
        const response = await apiClient.get("/api/users");
        if (response.data) {
            currentUser.set(response.data);
            isAuthenticated.set(true);
            return true;
        }
    } catch (err) {
        console.error("Failed to verify login:", err);
        // If verification fails, clear everything
        removeAuthToken();
        removeAuthId();
        delete apiClient.defaults.headers.common["Authorization"];
        isAuthenticated.set(false);
        currentUser.set(null);
        return false;
    }
    return true;
};

export const logout = () => {
    removeAuthToken();
    removeAuthId();
    delete apiClient.defaults.headers.common["Authorization"];
    isAuthenticated.set(false);
    currentUser.set(null);
};
