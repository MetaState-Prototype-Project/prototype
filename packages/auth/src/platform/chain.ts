/**
 * The chain of trust from a live deployment back to the association's
 * certificate.
 *
 * A platform token today is a bearer string minted for any self-asserted name,
 * so an eVault cannot tell one platform from another. This replaces that with
 * six links, each of which fails closed:
 *
 *   1. the deployment holds the private half of a key someone vouched for;
 *   2. a named person authorised that key for this platform and environment;
 *   3. the documents that person signed are the ones presented, unaltered;
 *   4. the version identifier is derivable from the platform and version;
 *   5. that release was submitted to the association by its author;
 *   6. the association certified it, at a level, for named domains.
 *
 * Every link is checked and reported even after one fails, because a
 * deployment operator debugging a rejected handshake needs to see the whole
 * trace, not just the first problem.
 */

import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import {
	bindingDocumentHash,
	sha256Base64Url,
	stableStringify,
} from "./bytes.js";
import { verifyP256 } from "./p256.js";
import {
	CERTIFICATION_LEVELS,
	type CertificationLevel,
	type ChainResult,
	type DeploymentEvidence,
	type HandshakeChallenge,
	type HandshakeResponse,
	type LinkId,
	type LinkResult,
	type PlatformClaim,
} from "./types.js";

const CHALLENGE_PREFIX = "w3ds:pp-auth:v1:";
const DEPLOYMENT_PREFIX = "gitw3:deployment:v1:";
const SUBMISSION_PREFIX = "gitw3:ppa:v1:";
const BUNDLE_TYPE = "deployment_attestation_bundle";

/** Whatever `jwtVerify` accepts as a key source. */
export type JwksResolver = (uri: string) => Parameters<typeof jwtVerify>[1];

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

const remoteJwks: JwksResolver = (uri) => {
	let set = jwksCache.get(uri);
	if (!set) {
		set = createRemoteJWKSet(new URL(uri));
		jwksCache.set(uri, set);
	}
	return set;
};

/** What a deployment signs to prove it holds the key. */
export function challengePayload(
	challenge: HandshakeChallenge,
	deploymentEname: string,
): string {
	return (
		CHALLENGE_PREFIX +
		sha256Base64Url(
			stableStringify({
				audience: challenge.audience,
				deploymentEname,
				expiresAt: challenge.expiresAt,
				issuedAt: challenge.issuedAt,
				nonce: challenge.nonce,
			}),
		)
	);
}

/**
 * Verifies a wallet signature by resolving the signer's key through the
 * registry. Injectable so the chain can be tested without a live registry, and
 * so a consumer that already resolves keys can supply its own.
 */
export type WalletVerifier = (
	signer: string,
	signature: string,
	payload: string,
) => Promise<boolean>;

export interface ChainOptions {
	/** Who the challenge was issued to, checked against the response. */
	audience: string;
	registryBaseUrl: string;
	/** JWKS that validates the wallet key-binding certificate on the submission proof. */
	registryJwksUri?: string;
	verifyWalletSignature?: WalletVerifier;
	/**
	 * How to turn a JWKS URI into keys. Injectable so a verifier can pin a key
	 * set, share a cache, or run offline.
	 */
	resolveJwks?: JwksResolver;
	now?: Date;
}

async function defaultWalletVerifier(
	registryBaseUrl: string,
): Promise<WalletVerifier> {
	const { verifySignature } = await import("signature-validator");
	return async (signer, signature, payload) => {
		const result = await verifySignature({
			eName: signer,
			signature,
			payload,
			registryBaseUrl,
		});
		return result.valid === true;
	};
}

function link(
	id: LinkId,
	title: string,
	proves: string,
	ok: boolean,
	detail: string,
): LinkResult {
	return { id, title, proves, ok, detail };
}

/** Derives the version eName the registry would mint, without asking it. */
export function softwareVersionEName(
	platformEname: string,
	version: string,
): string {
	const normalized = platformEname.replace(/^@/, "").replace(/-/g, "");
	if (!/^[0-9a-f]{32}$/i.test(normalized)) {
		throw new Error("platformEname must contain a UUID");
	}
	const digest = createHash("sha1")
		.update(Buffer.from(normalized, "hex"))
		.update(Buffer.from(`software-version:${version}`, "utf8"))
		.digest()
		.subarray(0, 16);
	digest[6] = (digest[6] & 0x0f) | 0x50;
	digest[8] = (digest[8] & 0x3f) | 0x80;
	const hex = digest.toString("hex");
	return `@${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface Bundle {
	type?: unknown;
	version?: unknown;
	documents?: unknown;
}

function parseBundle(signedPayload: string | undefined): Bundle | null {
	if (!signedPayload) return null;
	try {
		const bundle = JSON.parse(signedPayload) as Bundle;
		if (
			bundle.type !== BUNDLE_TYPE ||
			bundle.version !== 1 ||
			!Array.isArray(bundle.documents) ||
			bundle.documents.length !== 2
		) {
			return null;
		}
		return bundle;
	} catch {
		return null;
	}
}

function bundleContains(
	bundle: Bundle,
	doc: { subject: string; type: string; data: unknown },
): boolean {
	const expected = bindingDocumentHash(doc);
	return (bundle.documents as unknown[]).some((item) => {
		if (!item || typeof item !== "object") return false;
		const entry = item as Record<string, unknown>;
		return (
			entry.hash === expected &&
			entry.subject === doc.subject &&
			entry.type === doc.type
		);
	});
}

function bundleSignature(doc: {
	signatures: DeploymentEvidence["deploymentKeyDocument"]["signatures"];
}) {
	return doc.signatures.find(
		(signature) => signature.scope === "bundle" && signature.signedPayload,
	);
}

export async function verifyDeploymentChain(
	response: HandshakeResponse,
	options: ChainOptions,
): Promise<ChainResult> {
	const links: LinkResult[] = [];
	const evidence = response.evidence;
	const now = options.now ?? new Date();
	const walletVerifier =
		options.verifyWalletSignature ??
		(await defaultWalletVerifier(options.registryBaseUrl));
	const jwks = options.resolveJwks ?? remoteJwks;

	// 1. Possession. Without this the rest is a bundle of public documents that
	// anyone who has read the platform's eVault could replay.
	const keyDoc = evidence.deploymentKeyDocument;
	const documentKey =
		typeof keyDoc?.data?.publicKey === "string" ? keyDoc.data.publicKey : "";
	const challengeFresh =
		Date.parse(response.challenge.expiresAt) > now.getTime() &&
		response.challenge.audience === options.audience;
	const possession =
		challengeFresh &&
		documentKey.length > 0 &&
		documentKey === evidence.publicKey &&
		(await verifyP256(
			documentKey,
			response.signature,
			challengePayload(response.challenge, evidence.deploymentEname),
		));
	links.push(
		link(
			"possession",
			"Deployment holds its key",
			"the caller is this deployment, not someone replaying its public records",
			possession,
			possession
				? "Signed the challenge with the key named in its deployment document."
				: !challengeFresh
					? "The challenge was expired or issued to a different audience."
					: "The challenge signature did not verify against the deployment key.",
		),
	);

	// 2. Someone authorised that key. The bundle signature is a wallet signature
	// by a named person, so authority traces to a human, not to a config file.
	const signature = bundleSignature(keyDoc);
	const bundle = parseBundle(signature?.signedPayload);
	const keyDocCore = keyDoc
		? { subject: keyDoc.subject, type: keyDoc.type, data: keyDoc.data }
		: null;
	let authorised = false;
	let authorisedDetail = "The deployment document carried no bundle signature.";
	if (signature && bundle && keyDocCore) {
		if (signature.signer !== evidence.deployerEname) {
			authorisedDetail = `Signed by ${signature.signer}, which is not the named deployer.`;
		} else if (!bundleContains(bundle, keyDocCore)) {
			authorisedDetail = "The deployment document is not the one that was signed.";
		} else {
			const digest = sha256Base64Url(signature.signedPayload as string);
			authorised = await walletVerifier(
				signature.signer,
				signature.signature,
				`${DEPLOYMENT_PREFIX}${digest}`,
			);
			authorisedDetail = authorised
				? `${evidence.deployerEname} authorised this key for ${evidence.deploymentName} (${evidence.environment}).`
				: "The deployer's wallet signature did not verify.";
		}
	}
	links.push(
		link(
			"deployment-authorised",
			"A person authorised the key",
			"a named human, not an anonymous process, put this deployment on the network",
			authorised,
			authorisedDetail,
		),
	);

	// 3. Both documents in the bundle are the ones that were signed. Checking
	// only the key document would let the version document be swapped for one
	// pointing at a different, better-certified release.
	const versionDoc = evidence.softwareVersionDocument;
	const versionDocCore = versionDoc
		? { subject: versionDoc.subject, type: versionDoc.type, data: versionDoc.data }
		: null;
	const versionSignature = bundleSignature(versionDoc);
	const integrity =
		Boolean(bundle) &&
		Boolean(versionDocCore) &&
		bundleContains(bundle as Bundle, versionDocCore as NonNullable<typeof versionDocCore>) &&
		versionSignature?.signedPayload === signature?.signedPayload &&
		versionSignature?.signer === evidence.deployerEname;
	links.push(
		link(
			"bundle-integrity",
			"The documents are unaltered",
			"the release this deployment claims to run is the one that was signed for",
			integrity,
			integrity
				? "Both documents hash to the values covered by the signature."
				: "A document in the bundle did not match what was signed.",
		),
	);

	// 4. The version identifier is derivable, so it cannot be pointed at another
	// release. This is arithmetic, not a lookup — no network, nothing to spoof.
	let versionIdentity = false;
	let versionDetail = "The platform eName does not contain a UUID.";
	try {
		const expected = softwareVersionEName(
			evidence.platformEname,
			evidence.version,
		);
		const data = (versionDoc?.data ?? {}) as Record<string, unknown>;
		versionIdentity =
			expected === evidence.versionEname &&
			data.platformEname === evidence.platformEname &&
			data.version === evidence.version &&
			data.releaseTag === evidence.releaseTag &&
			data.commitSha === evidence.commitSha &&
			evidence.submissionProof.statement.version === evidence.version;
		versionDetail = versionIdentity
			? `${evidence.version} (${evidence.releaseTag}) at ${evidence.commitSha.slice(0, 12)}.`
			: "The version identifier does not derive from this platform and version.";
	} catch {
		versionIdentity = false;
	}
	links.push(
		link(
			"version-identity",
			"The version is what it says",
			"the certificate cannot be borrowed from a different release of the same platform",
			versionIdentity,
			versionDetail,
		),
	);

	// 5. The release was submitted by its author. This is the same proof the
	// association reviewed, re-verified here rather than taken on trust.
	const proof = evidence.submissionProof;
	let authorship = false;
	let authorshipDetail = "The release carried no submission proof.";
	if (proof?.statement) {
		const canonical =
			SUBMISSION_PREFIX + sha256Base64Url(JSON.stringify(proof.statement));
		if (proof.payload !== canonical) {
			authorshipDetail = "The signed payload does not match the statement.";
		} else if (proof.statement.platformEName !== evidence.platformEname) {
			authorshipDetail = "The submission is for a different platform.";
		} else {
			try {
				const jwksUri =
					options.registryJwksUri ??
					new URL("/.well-known/jwks.json", options.registryBaseUrl).toString();
				const { payload } = await jwtVerify(
					proof.keyBindingCertificate,
					jwks(jwksUri),
					{
						algorithms: ["ES256"],
						currentDate: new Date(proof.verifiedAt),
						requiredClaims: ["exp"],
					},
				);
				const certificateEName = String(
					payload.ename ?? payload.eName ?? payload.w3id ?? "",
				);
				if (
					certificateEName !== proof.statement.signerEName ||
					String(payload.publicKey ?? "") !== proof.publicKey
				) {
					authorshipDetail = "The key-binding certificate names a different signer.";
				} else {
					authorship = await verifyP256(
						proof.publicKey,
						proof.signature,
						proof.payload,
					);
					authorshipDetail = authorship
						? `Submitted by ${proof.statement.signerEName} from ${proof.statement.repository}.`
						: "The author's signature over the release did not verify.";
				}
			} catch (error) {
				authorshipDetail = `The key-binding certificate did not validate: ${error instanceof Error ? error.message : error}.`;
			}
		}
	}
	links.push(
		link(
			"release-authorship",
			"The author submitted this release",
			"the release under review was put forward by the people accountable for it",
			authorship,
			authorshipDetail,
		),
	);

	// 6. The association's decision. Everything above establishes what is
	// running; this establishes what it was certified to do.
	let claim: PlatformClaim | null = null;
	let accredited = false;
	let accreditationDetail = "No certificate was presented.";
	if (evidence.accreditationJws && evidence.issuerJwksUri) {
		try {
			const { payload } = await jwtVerify(
				evidence.accreditationJws,
				jwks(evidence.issuerJwksUri),
				{ algorithms: ["ES256"], subject: evidence.platformEname, currentDate: now },
			);
			const level = String(payload.level ?? "") as CertificationLevel;
			const domains = Array.isArray(payload.domains)
				? payload.domains.filter((d): d is string => typeof d === "string")
				: [];
			if (payload.decision !== "granted") {
				accreditationDetail = "The association refused this release.";
			} else if (!CERTIFICATION_LEVELS.includes(level)) {
				accreditationDetail = "The certificate names no valid level.";
			} else if (payload.platformVersion !== evidence.version) {
				accreditationDetail = `The certificate covers ${payload.platformVersion}, not ${evidence.version}.`;
			} else {
				accredited = true;
				accreditationDetail = `Certified ${level} for ${domains.join(", ") || "no domains"}.`;
				claim = {
					platformEname: evidence.platformEname,
					platformName: String(payload.platformName ?? evidence.deploymentName),
					deploymentEname: evidence.deploymentEname,
					version: evidence.version,
					level,
					// The release can only use what it asked for and was granted.
					domains: domains.filter((d) =>
						proof?.statement?.domains?.includes(d),
					),
					deployerEname: evidence.deployerEname,
					reviewedByEName: String(payload.reviewedBy ?? ""),
				};
			}
		} catch (error) {
			accreditationDetail = `The certificate did not verify: ${error instanceof Error ? error.message : error}.`;
		}
	}
	links.push(
		link(
			"accreditation",
			"The association certified it",
			"an accountable reviewer decided what this release may reach, and signed that decision",
			accredited,
			accreditationDetail,
		),
	);

	const failed = links.find((entry) => !entry.ok);
	return {
		ok: !failed,
		links,
		claim: failed ? null : claim,
		failedAt: failed ? failed.id : null,
	};
}
