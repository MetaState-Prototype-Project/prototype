import type { PageServerLoad } from "./$types";
import {
    accreditationKey,
    isReadConfigured,
    listAccreditations,
} from "$lib/server/aaas";
import { listDomains } from "$lib/server/domains";

export const load: PageServerLoad = async () => {
    if (!isReadConfigured()) {
        console.error(
            "[ppa] PPA_AWARENESS_API_KEY / AWARENESS_API_KEY is not set — decisions cannot be read",
        );
        return { accreditations: [], domains: [], loadError: null, connected: false };
    }

    try {
        const [records, domains] = await Promise.all([
            listAccreditations(),
            listDomains(),
        ]);

        // Records are newest first, so the first one seen for a platform and
        // version is the one in force; anything later in the list for that
        // same key was replaced by a reapplication.
        const seen = new Set<string>();
        const accreditations = records.map((record) => {
            const key = accreditationKey(
                record.platformEName,
                record.platformVersion,
            );
            const inForce = !seen.has(key);
            seen.add(key);
            return { ...record, inForce };
        });

        return { accreditations, domains, loadError: null, connected: true };
    } catch (error) {
        console.error("[ppa] failed loading accreditations:", error);
        return {
            accreditations: [],
            domains: [],
            connected: true,
            // The underlying cause is operational and already logged above.
            loadError: "We couldn't load the decision record just now. Try again in a moment.",
        };
    }
};
