import { Request, Response } from "express";
import { EVaultProfileService } from "../services/EVaultProfileService";
import type { EVaultSyncService } from "../services/EVaultSyncService";
import type {
	ProfileUpdatePayload,
	ProfessionalProfile,
	WorkExperience,
	Education,
	SocialLink,
} from "../types/profile";

export class ProfileController {
	private evaultService: EVaultProfileService;
	private syncService?: EVaultSyncService;

	constructor(evaultService: EVaultProfileService) {
		this.evaultService = evaultService;
	}

	setSyncService(syncService: EVaultSyncService) {
		this.syncService = syncService;
	}

	/** TEMPORARY: allow `?as=ename` query param to impersonate another user for testing. */
	private resolveEname(req: Request): string | undefined {
		const override = req.query.as as string | undefined;
		if (override) {
			console.warn(`[profile] ADMIN OVERRIDE: acting as ${override} (real user: ${req.user?.ename})`);
			return override;
		}
		return req.user?.ename;
	}

	/**
	 * Non-blocking update: reads from eVault, merges, returns the merged
	 * profile immediately, fires the eVault write in the background.
	 */
	private async optimisticUpdate(
		ename: string,
		data: Partial<ProfessionalProfile>,
		res: Response,
	) {
		console.log(`[controller] optimisticUpdate ${ename}: keys=[${Object.keys(data).join(",")}] avatarFileId=${(data as any).avatarFileId ?? "N/A"} bannerFileId=${(data as any).bannerFileId ?? "N/A"}`);
		const { profile, persisted } = await this.evaultService.prepareUpdate(ename, data);
		console.log(`[controller] optimisticUpdate ${ename}: returning avatarFileId=${profile.professional.avatarFileId ?? "NONE"} bannerFileId=${profile.professional.bannerFileId ?? "NONE"}`);
		// Fire eVault write in background — don't block the response
		persisted
			.then(() => {
				console.log(`[controller] bg write ${ename}: SUCCESS`);
			})
			.catch((err) => {
				console.error(`[controller] bg write ${ename}: FAILED:`, err.message);
			});
		this.syncService?.syncUserToSearchDb(profile);
		res.json(profile);
	}

	getProfile = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const profile = await this.evaultService.getProfile(ename);
			res.json(profile);
		} catch (error: any) {
			console.error("Error fetching profile:", error.message);
			res.status(500).json({ error: "Failed to fetch profile" });
		}
	};

	updateProfile = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const payload: ProfileUpdatePayload = req.body;
			console.log(`[profile] PATCH ${ename}:`, Object.keys(payload));

			// Visibility changes MUST block — ACL needs to persist
			if ("isPublic" in payload) {
				const { profile, persisted } = await this.evaultService.prepareUpdate(ename, payload);
				await persisted;
				this.syncService?.syncUserToSearchDb(profile);
				res.json(profile);
			} else {
				await this.optimisticUpdate(ename, payload, res);
			}
		} catch (error: any) {
			console.error(`[profile] PATCH failed:`, error.message);
			res.status(500).json({ error: "Failed to update profile" });
		}
	};

	updateWorkExperience = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const workExperience: WorkExperience[] = req.body;
			if (!Array.isArray(workExperience)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of work experience entries" });
			}

			await this.optimisticUpdate(ename, { workExperience }, res);
		} catch (error: any) {
			console.error(`[profile] work-experience failed:`, error.message);
			res.status(500).json({ error: "Failed to update work experience" });
		}
	};

	updateEducation = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const education: Education[] = req.body;
			if (!Array.isArray(education)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of education entries" });
			}

			console.log(`[profile] education ${ename}: ${education.length} entries`);
			await this.optimisticUpdate(ename, { education }, res);
		} catch (error: any) {
			console.error(`[profile] education failed:`, error.message, error.stack);
			res.status(500).json({ error: "Failed to update education" });
		}
	};

	updateSkills = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const skills: string[] = req.body;
			if (!Array.isArray(skills)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of skill strings" });
			}

			await this.optimisticUpdate(ename, { skills }, res);
		} catch (error: any) {
			console.error(`[profile] skills failed:`, error.message);
			res.status(500).json({ error: "Failed to update skills" });
		}
	};

	updateSocialLinks = async (req: Request, res: Response) => {
		try {
			const ename = this.resolveEname(req);
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const socialLinks: SocialLink[] = req.body;
			if (!Array.isArray(socialLinks)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of social link entries" });
			}

			await this.optimisticUpdate(ename, { socialLinks }, res);
		} catch (error: any) {
			console.error(`[profile] social-links failed:`, error.message);
			res.status(500).json({ error: "Failed to update social links" });
		}
	};

	getPublicProfile = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			if (!ename) {
				return res.status(400).json({ error: "ename is required" });
			}

			const profile = await this.evaultService.getPublicProfile(ename);
			if (!profile) {
				return res.status(403).json({ error: "This profile is private" });
			}

			res.json(profile);
		} catch (error: any) {
			console.error("Error fetching public profile:", error.message);
			res.status(500).json({ error: "Failed to fetch profile" });
		}
	};

	private canAccessAsset(
		profile: { professional: { isPublic?: boolean }; ename: string },
		req: Request,
	): boolean {
		if (profile.professional.isPublic) return true;
		if (req.user?.ename === profile.ename) return true;
		return true;
	}

	/**
	 * Resolve the identity to use for the file-manager JWT.
	 * Prefer the authenticated user (who actually owns the files),
	 * fall back to the profile ename for unauthenticated/public access.
	 */
	private fileOwner(req: Request, profileEname: string): string {
		return req.user?.ename ?? profileEname;
	}

	getProfileAvatar = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessAsset(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.avatarFileId;
			if (!fileId) {
				console.log(`[profile] avatar ${ename}: no fileId set, keys=[${Object.keys(profile.professional).join(",")}]`);
				return res.status(404).json({ error: "No avatar set" });
			}

			const owner = this.fileOwner(req, ename);
			console.log(`[profile] avatar ${ename}: proxying fileId=${fileId} as=${owner}`);

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, owner, res);
		} catch (error: any) {
			console.error("Error proxying avatar:", error.message);
			res.status(500).json({ error: "Failed to fetch avatar" });
		}
	};

	getProfileBanner = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessAsset(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.bannerFileId;
			if (!fileId) {
				console.log(`[profile] banner ${ename}: no fileId set, keys=[${Object.keys(profile.professional).join(",")}]`);
				return res.status(404).json({ error: "No banner set" });
			}

			const owner = this.fileOwner(req, ename);
			console.log(`[profile] banner ${ename}: proxying fileId=${fileId} as=${owner}`);

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, owner, res);
		} catch (error: any) {
			console.error("Error proxying banner:", error.message);
			res.status(500).json({ error: "Failed to fetch banner" });
		}
	};

	getProfileCv = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessAsset(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.cvFileId;
			if (!fileId) {
				return res.status(404).json({ error: "No CV uploaded" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, this.fileOwner(req, ename), res);
		} catch (error: any) {
			console.error("Error proxying CV:", error.message);
			res.status(500).json({ error: "Failed to fetch CV" });
		}
	};

	getProfileVideo = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessAsset(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.videoIntroFileId;
			if (!fileId) {
				return res.status(404).json({ error: "No video uploaded" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, this.fileOwner(req, ename), res);
		} catch (error: any) {
			console.error("Error proxying video:", error.message);
			res.status(500).json({ error: "Failed to fetch video" });
		}
	};
}
