/**
 * Builds a complete, self-consistent chain of trust from locally held keys.
 *
 * This exists so the verifier can be exercised without a wallet, a registry
 * and a live association — by the test suite, and by the demonstrator that
 * shows the handshake to a person. Everything it produces is genuine: real
 * P-256 signatures, real ES256 certificates, verified by exactly the same code
 * that verifies production evidence. What differs is the *root*: the keys
 * standing in for the deployer's wallet, the registry and the association are
 * generated here rather than held by those parties.
 *
 * So a chain that verifies against these roots proves the verifier works. It
 * does not prove anything about the platform — that is what the real roots are
 * for. Never configure a production verifier with roots from this module.
 */

import { randomUUID } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair as generateJwkPair } from "jose";
import type { JWK, KeyLike } from "jose";
import { bindingDocumentHash, sha256Base64Url } from "./bytes.js";
import { softwareVersionEName } from "./chain.js";
import { generateKeyPair, signP256, verifyP256 } from "./p256.js";
import type {
	BindingDocument,
	CertificationLevel,
	DeploymentEvidence,
	SubmissionStatement,
} from "./types.js";
import type { DeploymentIdentity } from "./deployment.js";
import type { WalletVerifier } from "./chain.js";

const DEPLOYMENT_PREFIX = "gitw3:deployment:v1:";
const SUBMISSION_PREFIX = "gitw3:ppa:v1:";

export interface Signer {
	privateKey: KeyLike;
	jwks: { keys: JWK[] };
	kid: string;
}

async function es256Signer(kid: string): Promise<Signer> {
	const { privateKey, publicKey } = await generateJwkPair("ES256", {
		extractable: true,
	});
	const jwk = await exportJWK(publicKey);
	return {
		privateKey,
		kid,
		jwks: { keys: [{ ...jwk, kid, alg: "ES256", use: "sig" }] },
	};
}

/**
 * The three parties a real chain roots in. In production these are the eID
 * wallet, the registry and the association; here they are local keys.
 */
export interface TrustRoots {
	/** Stands in for the deployer's and author's wallets. */
	wallet: { publicKey: string; privateKey: string; ename: string };
	registry: Signer;
	association: Signer;
	/** Verifies wallet signatures against the local wallet key. */
	verifyWalletSignature: WalletVerifier;
}

export async function createTrustRoots(
	walletEname = `@${randomUUID()}`,
): Promise<TrustRoots> {
	const wallet = await generateKeyPair();
	const [registry, association] = await Promise.all([
		es256Signer("demo-registry-key-1"),
		es256Signer("demo-association-key-1"),
	]);
	return {
		wallet: { ...wallet, ename: walletEname },
		registry,
		association,
		verifyWalletSignature: async (signer, signature, payload) =>
			signer === walletEname &&
			(await verifyP256(wallet.publicKey, signature, payload)),
	};
}

export interface DeploymentSpec {
	platformEname: string;
	platformName: string;
	deploymentName: string;
	environment: string;
	version: string;
	releaseTag: string;
	commitSha: string;
	repository: string;
	/** Domains the release asked the association for. */
	requestedDomains: string[];
	/** Domains the association actually granted. Defaults to what was requested. */
	grantedDomains?: string[];
	level: CertificationLevel;
	issuerJwksUri: string;
	registryJwksUri: string;
	reviewedByEName?: string;
	decision?: "granted" | "denied";
}

export interface MintedDeployment {
	identity: DeploymentIdentity;
	/** The bundle payload both documents were signed over, for display. */
	signedPayload: string;
}

/** Produces a deployment whose every link verifies against `roots`. */
export async function mintDeployment(
	roots: TrustRoots,
	spec: DeploymentSpec,
): Promise<MintedDeployment> {
	const key = await generateKeyPair();
	const deploymentEname = `@${randomUUID()}`;
	const versionEname = softwareVersionEName(spec.platformEname, spec.version);
	const now = new Date();
	const timestamp = now.toISOString();

	const keyDocCore = {
		subject: deploymentEname,
		type: "deployment_key",
		data: {
			kind: "deployment_key",
			deploymentName: spec.deploymentName,
			environment: spec.environment,
			deployerEname: roots.wallet.ename,
			platformEname: spec.platformEname,
			publicKey: key.publicKey,
			algorithm: "ECDSA_P256",
		},
	};
	const versionDocCore = {
		subject: versionEname,
		type: "software_version",
		data: {
			kind: "software_version",
			platformEname: spec.platformEname,
			versionEname,
			version: spec.version,
			releaseTag: spec.releaseTag,
			commitSha: spec.commitSha,
		},
	};

	// One signature covers both documents, which is what stops either being
	// swapped independently of the other.
	const signedPayload = JSON.stringify({
		type: "deployment_attestation_bundle",
		version: 1,
		documents: [keyDocCore, versionDocCore].map((doc) => ({
			hash: bindingDocumentHash(doc),
			subject: doc.subject,
			type: doc.type,
		})),
	});
	const bundleSignature = await signP256(
		roots.wallet.privateKey,
		`${DEPLOYMENT_PREFIX}${sha256Base64Url(signedPayload)}`,
	);
	const signature = {
		signer: roots.wallet.ename,
		signature: bundleSignature,
		timestamp,
		scope: "bundle" as const,
		signedPayload,
	};
	const deploymentKeyDocument: BindingDocument = {
		...keyDocCore,
		signatures: [signature],
	};
	const softwareVersionDocument: BindingDocument = {
		...versionDocCore,
		signatures: [signature],
	};

	const statement: SubmissionStatement = {
		type: "w3ds.ppa.release-submission",
		schemaVersion: 1,
		repositoryId: 1,
		repository: spec.repository,
		platformEName: spec.platformEname,
		platformName: spec.platformName,
		releaseTag: spec.releaseTag,
		version: spec.version,
		manifestCommitId: spec.commitSha,
		domains: spec.requestedDomains,
		signerEName: roots.wallet.ename,
		issuedAt: timestamp,
		nonce: randomUUID(),
	};
	const payload = SUBMISSION_PREFIX + sha256Base64Url(JSON.stringify(statement));
	const keyBindingCertificate = await new SignJWT({
		ename: roots.wallet.ename,
		publicKey: roots.wallet.publicKey,
	})
		.setProtectedHeader({ alg: "ES256", kid: roots.registry.kid })
		.setIssuedAt(now)
		.setExpirationTime("15m")
		.sign(roots.registry.privateKey);

	const grantedDomains = spec.grantedDomains ?? spec.requestedDomains;
	const accreditationJws = await new SignJWT({
		decision: spec.decision ?? "granted",
		level: spec.level,
		domains: grantedDomains,
		platformName: spec.platformName,
		platformVersion: spec.version,
		reviewedBy: spec.reviewedByEName ?? roots.wallet.ename,
	})
		.setProtectedHeader({ alg: "ES256", kid: roots.association.kid })
		.setSubject(spec.platformEname)
		.setJti(randomUUID())
		.setIssuedAt(now)
		.sign(roots.association.privateKey);

	const evidence: DeploymentEvidence = {
		deploymentEname,
		deploymentName: spec.deploymentName,
		environment: spec.environment,
		deployerEname: roots.wallet.ename,
		platformEname: spec.platformEname,
		versionEname,
		version: spec.version,
		releaseTag: spec.releaseTag,
		commitSha: spec.commitSha,
		publicKey: key.publicKey,
		deploymentKeyDocument,
		softwareVersionDocument,
		accreditationJws,
		issuerJwksUri: spec.issuerJwksUri,
		submissionProof: {
			statement,
			payload,
			signature: await signP256(roots.wallet.privateKey, payload),
			publicKey: roots.wallet.publicKey,
			keyBindingCertificate,
			verifiedAt: timestamp,
		},
	};

	return { identity: { evidence, privateKey: key.privateKey }, signedPayload };
}
