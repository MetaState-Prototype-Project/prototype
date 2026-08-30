import { authorize, type PlatformClaim } from "@metastate-foundation/auth/platform";
import { accreditations, platformProfile } from "$lib/server/aaas";
import { ownedByDomain } from "$lib/server/data";
import { currentPolicy } from "$lib/server/policy";
import type { PageServerLoad } from "./$types";

/**
 * The owner's own records, and — for each certified platform — what it would
 * be allowed to reach and what it would be refused.
 *
 * The decisions here are the real ones: the real certificate's domains, the
 * owner's real signed terms, and the same `authorize` an eVault would call.
 * What is not being claimed is that these platforms have asked; this is what
 * would happen if they did.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const ename = locals.user!.ename;

	const [groups, policy, records] = await Promise.all([
		ownedByDomain(ename).catch((error) => {
			console.error("[pp-auth-demo/data] could not read records:", error);
			return [];
		}),
		currentPolicy(ename),
		accreditations(),
	]);

	// Newest granted decision per platform.
	const granted = new Map<string, (typeof records)[number]>();
	for (const record of records) {
		if (record.decision !== "granted") continue;
		if (!granted.has(record.platformEName)) granted.set(record.platformEName, record);
	}

	const domainIds = groups.map((group) => group.id);

	const platforms = await Promise.all(
		[...granted.values()].map(async (record) => {
			const profile = await platformProfile(record.platformEName);
			const claim: PlatformClaim = {
				platformEname: record.platformEName,
				platformName: profile?.displayName || record.platformName,
				deploymentEname: "",
				version: record.platformVersion,
				level: (record.level ?? "L0") as PlatformClaim["level"],
				domains: record.domains ?? [],
				deployerEname: "",
				reviewedByEName: record.reviewedByEName,
			};
			return {
				ename: record.platformEName,
				name: claim.platformName,
				level: record.level,
				version: record.platformVersion,
				certifiedDomains: record.domains ?? [],
				decisions: domainIds.map((domain) => ({
					domain,
					...authorize(policy.statement, { claim, domain }),
				})),
			};
		}),
	);

	return { ename, groups, platforms, policy };
};
