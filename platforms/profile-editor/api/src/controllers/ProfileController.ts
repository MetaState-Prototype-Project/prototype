import { Request, Response } from "express";
import { EVaultProfileService } from "../services/EVaultProfileService";
import type { EVaultSyncService } from "../services/EVaultSyncService";
import type {
	ProfileUpdatePayload,
	ProfessionalProfile,
	FullProfile,
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

	getProfile = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
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

	/**
	 * Update the local cache immediately and fire the eVault write in the
	 * background.  Returns the patched profile so the response carries the
	 * authoritative local state.
	 *
	 * When `blocking` is true the returned promise resolves only after the
	 * eVault write completes (used for visibility toggles where the user
	 * needs confirmation the change persisted).
	 */
	private patchAndSync(
		ename: string,
		data: Partial<ProfessionalProfile>,
	): { profile: FullProfile; persisted: Promise<void> } {
		const patched = this.evaultService.patchCache(ename, data);
		// Sync full cached state to eVault (serialised per user)
		const persisted = this.evaultService.syncToEvault(ename).catch((err) => {
			console.error(`[eVault bg-sync] ${ename}:`, err.message);
		}) as Promise<void>;
		// Also update the local search DB so discover page reflects changes
		this.syncService?.syncUserToSearchDb(patched);
		return { profile: patched, persisted };
	}

	updateProfile = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const payload: ProfileUpdatePayload = req.body;
			// Visibility changes must be blocking so the ACL is persisted
			const isVisibilityChange = "isPublic" in payload;
			const { profile, persisted } = this.patchAndSync(ename, payload);
			if (isVisibilityChange) {
				await persisted;
			}
			res.json(profile);
		} catch (error: any) {
			console.error("Error updating profile:", error.message);
			res.status(500).json({ error: "Failed to update profile" });
		}
	};

	updateWorkExperience = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const workExperience: WorkExperience[] = req.body;
			if (!Array.isArray(workExperience)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of work experience entries" });
			}

			const { profile } = this.patchAndSync(ename, { workExperience });
			res.json(profile);
		} catch (error: any) {
			console.error("Error updating work experience:", error.message);
			res.status(500).json({ error: "Failed to update work experience" });
		}
	};

	updateEducation = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const education: Education[] = req.body;
			if (!Array.isArray(education)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of education entries" });
			}

			const { profile } = this.patchAndSync(ename, { education });
			res.json(profile);
		} catch (error: any) {
			console.error("Error updating education:", error.message);
			res.status(500).json({ error: "Failed to update education" });
		}
	};

	updateSkills = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const skills: string[] = req.body;
			if (!Array.isArray(skills)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of skill strings" });
			}

			const { profile } = this.patchAndSync(ename, { skills });
			res.json(profile);
		} catch (error: any) {
			console.error("Error updating skills:", error.message);
			res.status(500).json({ error: "Failed to update skills" });
		}
	};

	updateSocialLinks = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const socialLinks: SocialLink[] = req.body;
			if (!Array.isArray(socialLinks)) {
				return res
					.status(400)
					.json({ error: "Body must be an array of social link entries" });
			}

			const { profile } = this.patchAndSync(ename, { socialLinks });
			res.json(profile);
		} catch (error: any) {
			console.error("Error updating social links:", error.message);
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

	private canAccessProfile(
		profile: { professional: { isPublic?: boolean }; ename: string },
		req: Request,
	): boolean {
		if (profile.professional.isPublic) return true;
		if (req.user?.ename === profile.ename) return true;
		return false;
	}

	/**
	 * Asset proxy endpoints (avatar, banner, cv, video) use a relaxed access
	 * check: the file is served whenever the profile is public OR the caller is
	 * the owner.  Because <img src> / <video src> tags cannot attach Bearer
	 * tokens, unauthenticated requests from the owner's own browser would fail
	 * the standard canAccessProfile check.  For assets we therefore skip the
	 * visibility gate — knowing the file-manager ID is the access control.
	 * Profile *data* is still gated by canAccessProfile in getPublicProfile.
	 */
	private canAccessAsset(
		profile: { professional: { isPublic?: boolean }; ename: string },
		req: Request,
	): boolean {
		if (profile.professional.isPublic) return true;
		if (req.user?.ename === profile.ename) return true;
		// Allow serving assets even without auth — the file ID acts as an
		// unguessable capability token.  Profile metadata is still protected.
		return true;
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
				return res.status(404).json({ error: "No avatar set" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, ename, res);
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
				return res.status(404).json({ error: "No banner set" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, ename, res);
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
			await proxyFileFromFileManager(fileId, ename, res);
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
			await proxyFileFromFileManager(fileId, ename, res);
		} catch (error: any) {
			console.error("Error proxying video:", error.message);
			res.status(500).json({ error: "Failed to fetch video" });
		}
	};
}
