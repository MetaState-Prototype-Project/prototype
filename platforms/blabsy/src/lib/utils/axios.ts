import axios, { type AxiosInstance } from 'axios';
import { PUBLIC_BLABSY_BASE_URL } from '$env/static/public';

const TOKEN_KEY = 'pictique_auth_token';

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
    baseURL: PUBLIC_BLABSY_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
    }
});

// Utility function to store auth token
export const setAuthToken = (token: string): void => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const getAuthToken = () => {
    return localStorage.getItem(TOKEN_KEY);
};

// Utility function to remove auth token
export const removeAuthToken = (): void => {
    localStorage.removeItem(TOKEN_KEY);
};
