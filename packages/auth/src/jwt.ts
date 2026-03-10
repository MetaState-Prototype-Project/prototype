import jwt from "jsonwebtoken";
import type { JwtPayload } from "./types.js";

export function signToken(
	payload: JwtPayload,
	secret: string,
	options?: { expiresIn?: string | number },
): string {
	return jwt.sign(payload as object, secret, {
		expiresIn: (options?.expiresIn ?? "7d") as any,
	});
}

export function verifyToken(token: string, secret: string): JwtPayload {
	try {
		return jwt.verify(token, secret) as JwtPayload;
	} catch {
		throw new Error("Invalid token");
	}
}
