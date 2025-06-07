import { writable } from 'svelte/store';
import { apiClient, setAuthToken, removeAuthToken } from '$lib/utils/axios';

export const isAuthenticated = writable(false);

export const initializeAuth = () => {
    const token = localStorage.getItem('pictique_auth_token');
    if (token) {
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        isAuthenticated.set(true);
    }
};

export const login = (token: string) => {
    setAuthToken(token);
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    isAuthenticated.set(true);
};

export const logout = () => {
    removeAuthToken();
    delete apiClient.defaults.headers.common['Authorization'];
    isAuthenticated.set(false);
}; 