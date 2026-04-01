import { writable } from 'svelte/store';
import {
	apiClient,
	setAuthToken,
	removeAuthToken,
	getAuthToken,
	setAuthId,
	removeAuthId
} from '$lib/utils/axios';
import { profile } from '$lib/stores/profile';

export const isAuthenticated = writable(false);
export const currentUser = writable<{ id: string; ename: string; name?: string } | null>(null);
export const authInitialized = writable(false);

export async function initializeAuth(): Promise<void> {
	const token = getAuthToken();
	if (token) {
		apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
		try {
			const response = await apiClient.get('/api/profile');
			currentUser.set({
				id: response.data.ename,
				ename: response.data.ename,
				name: response.data.name
			});
			isAuthenticated.set(true);
		} catch {
			removeAuthToken();
			removeAuthId();
			isAuthenticated.set(false);
			currentUser.set(null);
			profile.set(null);
		}
	}
	authInitialized.set(true);
}

export function login(token: string, user: { id: string; ename: string; name?: string }): void {
	setAuthToken(token);
	setAuthId(user.id);
	profile.set(null);
	currentUser.set(user);
	isAuthenticated.set(true);
}

export function logout(): void {
	removeAuthToken();
	removeAuthId();
	delete apiClient.defaults.headers.common['Authorization'];
	isAuthenticated.set(false);
	currentUser.set(null);
	profile.set(null);
}
