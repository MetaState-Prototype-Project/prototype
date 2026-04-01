import { v4 as uuidv4 } from "uuid";
import type { AuthOfferConfig } from "./types.js";

export interface AuthOffer {
	uri: string;
	session: string;
}

export function buildAuthOffer(config: AuthOfferConfig): AuthOffer {
	const callbackPath = config.callbackPath ?? "/api/auth";
	const url = new URL(callbackPath, config.baseUrl).toString();
	const session = uuidv4();
	const uri = `w3ds://auth?redirect=${url}&session=${session}&platform=${config.platform}`;
	return { uri, session };
}
