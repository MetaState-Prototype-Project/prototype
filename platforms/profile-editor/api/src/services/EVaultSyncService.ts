import axios from "axios";
import { EVaultProfileService } from "./EVaultProfileService";
import { UserSearchService } from "./UserSearchService";

interface VaultEntry {
	ename: string;
	uri: string;
	evault: string;
}

export class EVaultSyncService {
	private evaultService: EVaultProfileService;
	private userSearchService: UserSearchService;
	private intervalId: ReturnType<typeof setInterval> | null = null;
	private syncing = false;

	private get registryUrl(): string {
		return process.env.PUBLIC_REGISTRY_URL || "http://localhost:4321";
	}

	constructor(evaultService: EVaultProfileService) {
		this.evaultService = evaultService;
		this.userSearchService = new UserSearchService();
	}

	start(intervalMs: number = 5 * 60 * 1000): void {
		this.syncAll();

		this.intervalId = setInterval(() => {
			this.syncAll();
		}, intervalMs);

		console.log(
			`eVault sync started (every ${Math.round(intervalMs / 1000)}s)`,
		);
	}

	stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
			console.log("eVault sync stopped");
		}
	}

	private async syncAll(): Promise<void> {
		if (this.syncing) {
			console.log("Sync already in progress, skipping");
			return;
		}

		this.syncing = true;
		const startTime = Date.now();

		try {
			const response = await axios.get<VaultEntry[]>(
				`${this.registryUrl}/list`,
				{ timeout: 10000 },
			);
			const vaults = response.data;

			let synced = 0;
			let failed = 0;

			for (const vault of vaults) {
				try {
					await this.syncUser(vault.ename);
					synced++;
				} catch {
					failed++;
				}
			}

			const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
			console.log(
				`eVault sync complete: ${synced} synced, ${failed} failed, ${elapsed}s`,
			);
		} catch (error: any) {
			console.error(
				"eVault sync failed to fetch registry list:",
				error.message,
			);
		} finally {
			this.syncing = false;
		}
	}

	private async syncUser(ename: string): Promise<void> {
		const profile = await this.evaultService.getProfile(ename);

		await this.userSearchService.upsertFromWebhook({
			ename,
			name: profile.name,
			handle: profile.handle,
			isVerified: profile.isVerified ?? false,
			bio: profile.professional.bio,
			headline: profile.professional.headline,
			location: profile.professional.location,
			avatarFileId: profile.professional.avatarFileId,
			bannerFileId: profile.professional.bannerFileId,
			skills: profile.professional.skills,
			isPublic: profile.professional.isPublic ?? true,
			isArchived: false,
		});
	}
}
