/**
 * Verifier side of the handshake.
 *
 * A challenge is single-use and short-lived: it is deleted the moment it is
 * answered, so a captured response cannot be replayed even inside its window.
 */

import { randomUUID } from "node:crypto";
import { verifyDeploymentChain, type ChainOptions } from "./chain.js";
import type { ChainResult, HandshakeChallenge, HandshakeResponse } from "./types.js";

const DEFAULT_TTL_MS = 2 * 60_000;

export interface ChallengeStore {
	issue(audience: string): HandshakeChallenge;
	/** Returns true once per challenge; false if unknown, expired or already spent. */
	redeem(nonce: string): boolean;
}

export function createChallengeStore(
	ttlMs = DEFAULT_TTL_MS,
	now: () => number = Date.now,
): ChallengeStore {
	const issued = new Map<string, number>();

	function sweep(): void {
		const cutoff = now();
		for (const [nonce, expiresAt] of issued) {
			if (expiresAt <= cutoff) issued.delete(nonce);
		}
	}

	return {
		issue(audience) {
			sweep();
			const at = now();
			const nonce = randomUUID();
			issued.set(nonce, at + ttlMs);
			return {
				nonce,
				audience,
				issuedAt: new Date(at).toISOString(),
				expiresAt: new Date(at + ttlMs).toISOString(),
			};
		},
		redeem(nonce) {
			sweep();
			return issued.delete(nonce);
		},
	};
}

export interface HandshakeOptions extends ChainOptions {
	store: ChallengeStore;
}

/**
 * Redeems the challenge and verifies the chain behind the response. The
 * challenge is spent whether or not the chain holds, so a failed attempt
 * cannot be retried against the same nonce.
 */
export async function verifyHandshake(
	response: HandshakeResponse,
	options: HandshakeOptions,
): Promise<ChainResult> {
	if (!options.store.redeem(response.challenge.nonce)) {
		return {
			ok: false,
			links: [
				{
					id: "possession",
					title: "Deployment holds its key",
					proves:
						"the caller is this deployment, not someone replaying its public records",
					ok: false,
					detail: "The challenge was unknown, expired or already answered.",
				},
			],
			claim: null,
			failedAt: "possession",
		};
	}
	return verifyDeploymentChain(response, options);
}
