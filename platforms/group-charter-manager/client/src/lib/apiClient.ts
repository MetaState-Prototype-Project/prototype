import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'group_charter_auth_token';

const headers: Record<string, string> = {
	'Content-Type': 'application/json'
};

if (getAuthToken()) {
	headers.authorization = `Bearer ${getAuthToken()}`;
}

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
	baseURL: process.env.NEXT_PUBLIC_GROUP_CHARTER_BASE_URL || 'http://localhost:3001',
	headers
});

// Utility function to store auth token
export const setAuthToken = (token: string): void => {
	localStorage.setItem(TOKEN_KEY, token);
};

export function getAuthToken() {
	if (typeof window !== 'undefined') {
		return localStorage.getItem(TOKEN_KEY);
	}
	return null;
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
	if (typeof window !== 'undefined') {
		return localStorage.getItem('ownerId');
	}
	return null;
};

// Utility function to remove auth id
export const removeAuthId = (): void => {
	localStorage.removeItem('ownerId');
};

// Add request interceptor to include auth token
apiClient.interceptors.request.use(
	(config) => {
		const token = getAuthToken();
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => {
		return Promise.reject(error);
	}
);

// Add response interceptor to handle auth errors
apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		if (error.response?.status === 401) {
			// Handle unauthorized error
			removeAuthToken();
			removeAuthId();
			// Redirect to login or show login modal
			if (typeof window !== 'undefined') {
				window.location.href = '/login';
			}
		}
		return Promise.reject(error);
	}
); 