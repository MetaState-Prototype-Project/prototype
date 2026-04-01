import { verifyToken } from "./jwt.js";
import type { AuthMiddlewareConfig } from "./types.js";

export function createAuthMiddleware(config: AuthMiddlewareConfig) {
	return async (req: any, res: any, next: any): Promise<void> => {
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader?.startsWith("Bearer ")) {
				return next();
			}

			const token = authHeader.split(" ")[1];
			const decoded = verifyToken(token, config.secret);

			if (!decoded?.userId) {
				return res.status(401).json({ error: "Invalid token" });
			}

			const user = await config.findUser(decoded.userId);

			if (!user) {
				return res.status(401).json({ error: "User not found" });
			}

			req.user = user;
			next();
		} catch (error) {
			console.error("Auth middleware error:", error);
			res.status(401).json({ error: "Invalid token" });
		}
	};
}
