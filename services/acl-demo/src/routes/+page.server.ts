import { load as loadCast } from "$lib/server/cast";
import { BEATS, CHARACTERS } from "$lib/server/walkthrough";
import type { PageServerLoad } from "./$types";

/**
 * The whole sequence, sent up front.
 *
 * Narration beats carry everything they need, so clicking through the cast is
 * instant; only `ask` and `act` beats go back to the server, because only they
 * touch an eVault.
 */
export const load: PageServerLoad = async () => {
	const cast = await loadCast();
	const byKey = Object.fromEntries((cast?.members ?? []).map((m) => [m.key, m]));

	return {
		ready: Boolean(cast?.groupRecord && cast?.scratch?.walkthrough),
		note: cast?.scratch?.walkthrough ?? null,
		vault: byKey.alice?.ename ?? null,
		labels: Object.fromEntries((cast?.members ?? []).map((m) => [m.ename, m.label])),
		beats: BEATS.map((beat) => {
			if (beat.kind === "cast") {
				const member = byKey[beat.who];
				return {
					kind: "cast" as const,
					say: beat.say,
					label: member?.label ?? beat.who,
					ename: member?.ename ?? null,
					role: member?.role ?? null,
				};
			}
			if (beat.kind === "chapter") {
				return { kind: "chapter" as const, title: beat.title, say: beat.say };
			}
			return {
				kind: beat.kind,
				say: beat.say,
				who: beat.kind === "ask" ? CHARACTERS[beat.party].label : null,
				verb: beat.kind === "ask" ? beat.verb : null,
			};
		}),
	};
};
