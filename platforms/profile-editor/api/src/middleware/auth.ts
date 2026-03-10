import {
	createAuthMiddleware,
	createAuthGuard,
} from "@metastate-foundation/auth";
import { AppDataSource } from "../database/data-source";
import { Session } from "../database/entities/Session";
import { MoreThan } from "typeorm";

const JWT_SECRET = process.env.PROFILE_EDITOR_JWT_SECRET;
if (!JWT_SECRET) throw new Error("PROFILE_EDITOR_JWT_SECRET not configured");

export async function registerSession(
	userId: string,
	ename: string,
	token: string,
): Promise<void> {
	const repo = AppDataSource.getRepository(Session);

	await repo.delete({ userId });

	const session = repo.create({
		userId,
		ename,
		token,
		expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
	});

	await repo.save(session);
}

export const authMiddleware = createAuthMiddleware({
	secret: JWT_SECRET,
	findUser: async (userId: string) => {
		if (!AppDataSource.isInitialized) {
			return null;
		}

		const repo = AppDataSource.getRepository(Session);
		const session = await repo.findOneBy({
			userId,
			expiresAt: MoreThan(new Date()),
		});

		if (!session) return null;
		return { id: session.userId, ename: session.ename };
	},
});

export const authGuard = createAuthGuard();
