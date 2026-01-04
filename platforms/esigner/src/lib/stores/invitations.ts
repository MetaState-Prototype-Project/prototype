import { writable } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';
import type { Writable } from 'svelte/store';

export interface Invitation {
	id: string;
	fileId: string;
	userId: string;
	status: 'pending' | 'signed' | 'declined';
	invitedAt: string;
	signedAt?: string;
	declinedAt?: string;
	file?: {
		id: string;
		name: string;
		displayName?: string | null;
		description?: string | null;
		mimeType: string;
		size: number;
		ownerId: string;
		createdAt: string;
	};
	user?: {
		id: string;
		name: string;
		ename: string;
		avatarUrl?: string;
	};
}

export const invitations: Writable<Invitation[]> = writable([]);
export const isLoading = writable(false);
export const error = writable<string | null>(null);

export const fetchInvitations = async () => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.get('/api/invitations');
		invitations.set(response.data);
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to fetch invitations');
		throw err;
	} finally {
		isLoading.set(false);
	}
};

export const inviteSignees = async (fileId: string, userIds: string[]) => {
	try {
		isLoading.set(true);
		error.set(null);
		const response = await apiClient.post(`/api/files/${fileId}/invite`, { userIds });
		return response.data;
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to invite signees');
		throw err;
	} finally {
		isLoading.set(false);
	}
};

export const declineInvitation = async (invitationId: string) => {
	try {
		isLoading.set(true);
		error.set(null);
		await apiClient.post(`/api/invitations/${invitationId}/decline`);
		await fetchInvitations();
	} catch (err) {
		error.set(err instanceof Error ? err.message : 'Failed to decline invitation');
		throw err;
	} finally {
		isLoading.set(false);
	}
};


