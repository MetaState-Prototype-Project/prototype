import { writable, get } from 'svelte/store';
import { apiClient } from '$lib/utils/axios';
import { currentUser } from '$lib/stores/auth';

export interface WorkExperience {
	id?: string;
	company: string;
	role: string;
	description?: string;
	startDate: string;
	endDate?: string;
	location?: string;
	sortOrder: number;
}

export interface Education {
	id?: string;
	institution: string;
	degree: string;
	fieldOfStudy?: string;
	startDate: string;
	endDate?: string;
	description?: string;
	sortOrder: number;
}

export interface SocialLink {
	id?: string;
	platform: string;
	url: string;
	label?: string;
}

export interface ProfileData {
	ename: string;
	name?: string;
	handle?: string;
	isVerified?: boolean;
	professional: {
		displayName?: string;
		headline?: string;
		bio?: string;
		avatarFileId?: string;
		bannerFileId?: string;
		cvFileId?: string;
		videoIntroFileId?: string;
		email?: string;
		phone?: string;
		website?: string;
		location?: string;
		isPublic?: boolean;
		workExperience?: WorkExperience[];
		education?: Education[];
		skills?: string[];
		socialLinks?: SocialLink[];
	};
}

export const profile = writable<ProfileData | null>(null);
export const profileLoading = writable(false);

/** TEMPORARY: set via ?as= query param to impersonate another user for testing */
let _adminOverride: string | null = null;
export function setAdminOverride(ename: string | null) { _adminOverride = ename; }
export function getAdminOverride() { return _adminOverride; }

function apiSuffix(): string {
	return _adminOverride ? `?as=${encodeURIComponent(_adminOverride)}` : '';
}

export async function fetchProfile(): Promise<ProfileData> {
	profileLoading.set(true);
	try {
		const response = await apiClient.get(`/api/profile${apiSuffix()}`);
		const data = response.data;
		profile.set(data);
		// Sync name to header when viewing own profile
		const user = get(currentUser);
		if (user?.ename === data.ename && data.name) {
			currentUser.update((u) => (u ? { ...u, name: data.name } : u));
		}
		return data;
	} finally {
		profileLoading.set(false);
	}
}

export async function updateProfile(data: Record<string, unknown>): Promise<ProfileData> {
	const response = await apiClient.patch(`/api/profile${apiSuffix()}`, data);
	const updated = response.data;
	profile.set(updated);
	const user = get(currentUser);
	if (user?.ename === updated.ename && updated.name) {
		currentUser.update((u) => (u ? { ...u, name: updated.name } : u));
	}
	return updated;
}

export async function updateWorkExperience(entries: WorkExperience[]): Promise<ProfileData> {
	const response = await apiClient.put(`/api/profile/work-experience${apiSuffix()}`, entries);
	profile.set(response.data);
	return response.data;
}

export async function updateEducation(entries: Education[]): Promise<ProfileData> {
	const response = await apiClient.put(`/api/profile/education${apiSuffix()}`, entries);
	profile.set(response.data);
	return response.data;
}

export async function updateSkills(skills: string[]): Promise<ProfileData> {
	const response = await apiClient.put(`/api/profile/skills${apiSuffix()}`, skills);
	profile.set(response.data);
	return response.data;
}

export async function updateSocialLinks(links: SocialLink[]): Promise<ProfileData> {
	const response = await apiClient.put(`/api/profile/social-links${apiSuffix()}`, links);
	profile.set(response.data);
	return response.data;
}

export async function fetchPublicProfile(ename: string): Promise<ProfileData> {
	const response = await apiClient.get(`/api/profiles/${ename}`);
	return response.data;
}
