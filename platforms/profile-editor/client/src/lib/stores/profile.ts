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

export async function fetchProfile(): Promise<ProfileData> {
	profileLoading.set(true);
	try {
		const response = await apiClient.get('/api/profile');
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

export async function updateProfile(data: Record<string, unknown>): Promise<void> {
	// Optimistic update
	profile.update((p) => p ? { ...p, ...data, professional: { ...p.professional, ...data } } : p);
	if (data.displayName || data.name) {
		const user = get(currentUser);
		const name = (data.displayName ?? data.name) as string;
		if (user && name) {
			currentUser.update((u) => (u ? { ...u, name } : u));
		}
	}
	await apiClient.patch('/api/profile', data);
}

export async function updateWorkExperience(entries: WorkExperience[]): Promise<void> {
	profile.update((p) => p ? { ...p, professional: { ...p.professional, workExperience: entries } } : p);
	await apiClient.put('/api/profile/work-experience', entries);
}

export async function updateEducation(entries: Education[]): Promise<void> {
	profile.update((p) => p ? { ...p, professional: { ...p.professional, education: entries } } : p);
	await apiClient.put('/api/profile/education', entries);
}

export async function updateSkills(skills: string[]): Promise<void> {
	profile.update((p) => p ? { ...p, professional: { ...p.professional, skills } } : p);
	await apiClient.put('/api/profile/skills', skills);
}

export async function updateSocialLinks(links: SocialLink[]): Promise<void> {
	profile.update((p) => p ? { ...p, professional: { ...p.professional, socialLinks: links } } : p);
	await apiClient.put('/api/profile/social-links', links);
}

export async function fetchPublicProfile(ename: string): Promise<ProfileData> {
	const response = await apiClient.get(`/api/profiles/${ename}`);
	return response.data;
}
