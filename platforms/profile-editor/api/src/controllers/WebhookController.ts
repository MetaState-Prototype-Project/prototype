import { Request, Response } from "express";
import { Web3Adapter } from "web3-adapter";
import { UserSearchService } from "../services/UserSearchService";

export class WebhookController {
	private userSearchService: UserSearchService;
	private adapter: Web3Adapter;

	constructor(adapter: Web3Adapter) {
		this.userSearchService = new UserSearchService();
		this.adapter = adapter;
	}

	handleWebhook = async (req: Request, res: Response) => {
		try {
			const schemaId = req.body.schemaId;
			const globalId = req.body.id;
			const mapping = Object.values(this.adapter.mapping).find(
				(m) => m.schemaId === schemaId,
			);

			this.adapter.addToLockedIds(globalId);

			if (!mapping) {
				return res.status(200).send("Unknown schema, skipping");
			}

			const local = await this.adapter.fromGlobal({
				data: req.body.data,
				mapping,
			});

			const localId = await this.adapter.mappingDb.getLocalId(globalId);

			if (mapping.tableName === "users") {
				await this.handleUserWebhook(
					local.data,
					localId,
					globalId,
					req.body,
				);
			} else if (mapping.tableName === "professional_profiles") {
				await this.handleProfessionalProfileWebhook(
					local.data,
					localId,
					globalId,
					req.body,
				);
			}

			res.status(200).send();
		} catch (e) {
			console.error("Webhook error:", e);
			res.status(200).send();
		}
	};

	private async handleUserWebhook(
		localData: any,
		localId: string | null,
		globalId: string,
		rawBody: any,
	) {
		const ename = localData.ename || rawBody.w3id;
		if (!ename) return;

		const userData: any = {
			ename,
			handle: localData.handle,
			name: rawBody.data?.displayName || localData.name,
			bio: localData.bio,
			isVerified: localData.isVerified ?? false,
			isPublic: localData.isPublic !== false,
			isArchived: localData.isArchived ?? false,
		};

		if (localData.avatarFileId) userData.avatarFileId = localData.avatarFileId;
		if (localData.bannerFileId) userData.bannerFileId = localData.bannerFileId;
		if (localData.location) userData.location = localData.location;

		const user = await this.userSearchService.upsertFromWebhook(userData);

		await this.adapter.mappingDb.storeMapping({
			localId: user.id,
			globalId,
		});
		this.adapter.addToLockedIds(user.id);
		this.adapter.addToLockedIds(globalId);
	}

	private async handleProfessionalProfileWebhook(
		localData: any,
		localId: string | null,
		globalId: string,
		rawBody: any,
	) {
		const ename = rawBody.w3id;
		if (!ename) return;

		const profileData: any = { ename };

		if (localData.name || rawBody.data?.displayName) {
			profileData.name = rawBody.data?.displayName || localData.name;
		}
		if (localData.headline) profileData.headline = localData.headline;
		if (localData.bio) profileData.bio = localData.bio;
		if (localData.avatarFileId)
			profileData.avatarFileId = localData.avatarFileId;
		if (localData.bannerFileId)
			profileData.bannerFileId = localData.bannerFileId;
		if (localData.cvFileId) profileData.cvFileId = localData.cvFileId;
		if (localData.videoIntroFileId)
			profileData.videoIntroFileId = localData.videoIntroFileId;
		if (localData.location) profileData.location = localData.location;
		if (localData.skills) profileData.skills = localData.skills;
		if (localData.isPublic !== undefined)
			profileData.isPublic = localData.isPublic;

		const user =
			await this.userSearchService.upsertFromWebhook(profileData);

		await this.adapter.mappingDb.storeMapping({
			localId: user.id,
			globalId,
		});
		this.adapter.addToLockedIds(user.id);
		this.adapter.addToLockedIds(globalId);
	}
}
