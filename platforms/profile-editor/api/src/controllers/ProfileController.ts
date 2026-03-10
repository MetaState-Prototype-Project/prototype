import { Request, Response } from "express";
import { EVaultProfileService } from "../services/EVaultProfileService";
import type {
	ProfileUpdatePayload,
	WorkExperience,
	Education,
	SocialLink,
} from "../types/profile";

export class ProfileController {
	private evaultService: EVaultProfileService;

	constructor(evaultService: EVaultProfileService) {
		this.evaultService = evaultService;
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

	updateProfile = async (req: Request, res: Response) => {
		try {
			const ename = req.user?.ename;
			if (!ename) {
				return res.status(401).json({ error: "Authentication required" });
			}

			const payload: ProfileUpdatePayload = req.body;
			const profile = await this.evaultService.upsertProfile(
				ename,
				payload,
			);
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

			const profile = await this.evaultService.upsertProfile(ename, {
				workExperience,
			});
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

			const profile = await this.evaultService.upsertProfile(ename, {
				education,
			});
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

			const profile = await this.evaultService.upsertProfile(ename, {
				skills,
			});
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

			const profile = await this.evaultService.upsertProfile(ename, {
				socialLinks,
			});
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
		return req.user?.ename === profile.ename;
	}

	getProfileAvatar = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessProfile(profile, req)) {
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

			if (!this.canAccessProfile(profile, req)) {
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

			if (!this.canAccessProfile(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.cvFileId;
			if (!fileId) {
				return res.status(404).json({ error: "No CV uploaded" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, ename, res, "download");
		} catch (error: any) {
			console.error("Error proxying CV:", error.message);
			res.status(500).json({ error: "Failed to fetch CV" });
		}
	};

	getProfileVideo = async (req: Request, res: Response) => {
		try {
			const { ename } = req.params;
			const profile = await this.evaultService.getProfile(ename);

			if (!this.canAccessProfile(profile, req)) {
				return res.status(403).json({ error: "This profile is private" });
			}

			const fileId = profile.professional.videoIntroFileId;
			if (!fileId) {
				return res.status(404).json({ error: "No video uploaded" });
			}

			const { proxyFileFromFileManager } = await import(
				"../utils/file-proxy"
			);
			await proxyFileFromFileManager(fileId, ename, res, "download");
		} catch (error: any) {
			console.error("Error proxying video:", error.message);
			res.status(500).json({ error: "Failed to fetch video" });
		}
	};
}
