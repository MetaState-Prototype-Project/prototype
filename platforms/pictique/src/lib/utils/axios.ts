import axios, { type AxiosInstance } from 'axios';
import { PUBLIC_PICTIQUE_BASE_URL } from '$env/static/public';

const TOKEN_KEY = 'pictique_auth_token';

let headers: Record<string, any> = {
    'Content-Type': 'application/json'
};
if (getAuthToken()) {
    headers.authorization = `Bearer ${getAuthToken()}`;
}

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
    baseURL: PUBLIC_PICTIQUE_BASE_URL,
    headers
});

// Utility function to store auth token
export const setAuthToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
    window.location.href = '/home';
};

export function getAuthToken() {
    return localStorage.getItem(TOKEN_KEY);
}

// Utility function to remove auth token
export const removeAuthToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};

// Utility function to store auth id
export const setAuthId = (id: string): void => {
    localStorage.setItem('ownerId', id);
};

export const getAuthId = () => {
    return localStorage.getItem('ownerId');
};

// Utility function to remove auth token
export const removeAuthId = (): void => {
    localStorage.removeItem('ownerId');
};
