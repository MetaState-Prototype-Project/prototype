import { PUBLIC_PROFILE_EDITOR_BASE_URL } from '$env/static/public';
import axios, { type AxiosInstance } from 'axios';

const TOKEN_KEY = 'profile_editor_auth_token';
const ID_KEY = 'profile_editor_auth_id';

export function getAuthToken(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
	localStorage.setItem(TOKEN_KEY, token);
	apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function removeAuthToken(): void {
	localStorage.removeItem(TOKEN_KEY);
	delete apiClient.defaults.headers.common['Authorization'];
}

export function getAuthId(): string | null {
	if (typeof window === 'undefined') return null;
	return localStorage.getItem(ID_KEY);
}

export function setAuthId(id: string): void {
	localStorage.setItem(ID_KEY, id);
}

export function removeAuthId(): void {
	localStorage.removeItem(ID_KEY);
}

const headers: Record<string, string> = {
	'Content-Type': 'application/json'
};

const token = typeof window !== 'undefined' ? getAuthToken() : null;
if (token) {
	headers['Authorization'] = `Bearer ${token}`;
}

export const apiClient: AxiosInstance = axios.create({
	baseURL: PUBLIC_PROFILE_EDITOR_BASE_URL || 'http://localhost:3006',
	headers
});
