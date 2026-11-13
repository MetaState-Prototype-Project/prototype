import { accreditations, deployments, isConfigured, platformProfile } from "$lib/server/aaas";
import { accreditationFor } from "$lib/server/chain";
import { held } from "$lib/server/keys";
import type { PageServerLoad } from "./$types";

export interface PlatformView {
	ename: string;
	name: string;
	description: string;
	currentVersion: string;
	logoUrl: string | null;
	deployments: Array<{
		ename: string;
		name: string;
		environment: string;
		version: string;
		releaseTag: string;
		commitSha: string;
		deployerEname: string;
		publicKey: string;
		/** The decision covering this deployment's exact version. */
		certified: { level: string | null; domains: string[]; decision: string } | null;
		keyHeld: boolean;
	}>;
}

/**
 * Every platform the network knows about that has at least one deployment or
 * one certification decision. Nothing is seeded: an empty page means nothing
 * has been deployed or certified yet, which is a true statement about the
 * network rather than a failure of this app.
 */
export const load: PageServerLoad = async () => {
	if (!isConfigured()) {
		return { configured: false, platforms: [] as PlatformView[], error: null };
	}

	try {
		const [allDeployments, allAccreditations] = await Promise.all([
			deployments(),
			accreditations(),
		]);

		const enames = new Set<string>([
			...allDeployments.map((d) => d.platformEname),
			...allAccreditations.map((a) => a.platformEName),
		]);

		const withKeys = new Set(held());

		const platforms = await Promise.all(
			[...enames].map(async (ename): Promise<PlatformView> => {
				const profile = await platformProfile(ename);
				const mine = allDeployments
					.filter((d) => d.platformEname === ename)
					.sort((a, b) => a.environment.localeCompare(b.environment));
				return {
					ename,
					name: profile?.displayName || profile?.platformName || ename,
					description: profile?.description ?? "",
					currentVersion: profile?.version ?? "",
					logoUrl: profile?.logoUrl ?? null,
					deployments: mine.map((deployment) => {
						const decision = accreditationFor(
							allAccreditations,
							ename,
							deployment.version,
						);
						return {
							ename: deployment.deploymentEname,
							name: deployment.deploymentName,
							environment: deployment.environment,
							version: deployment.version,
							releaseTag: deployment.releaseTag,
							commitSha: deployment.commitSha,
							deployerEname: deployment.deployerEname,
							publicKey: deployment.publicKey,
							keyHeld: withKeys.has(deployment.deploymentEname),
							certified: decision
								? {
										level: decision.level,
										domains: decision.domains ?? [],
										decision: decision.decision,
									}
								: null,
						};
					}),
				};
			}),
		);

		platforms.sort((a, b) => b.deployments.length - a.deployments.length);
		return { configured: true, platforms, error: null };
	} catch (error) {
		console.error("[pp-auth-demo/platforms] load failed:", error);
		return {
			configured: true,
			platforms: [] as PlatformView[],
			error: error instanceof Error ? error.message : "could not read the network",
		};
	}
};
