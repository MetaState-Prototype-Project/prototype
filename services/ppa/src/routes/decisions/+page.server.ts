import type { PageServerLoad } from "./$types";
import { isReadConfigured, listAccreditations } from "$lib/server/aaas";
import { listDomains } from "$lib/server/domains";

export const load: PageServerLoad = async () => {
    if (!isReadConfigured()) {
        console.error(
            "[ppa] PPA_AWARENESS_API_KEY / AWARENESS_API_KEY is not set — decisions cannot be read",
        );
        return { accreditations: [], domains: [], loadError: null, connected: false };
    }

    try {
        const [accreditations, domains] = await Promise.all([
            listAccreditations(),
            listDomains(),
        ]);
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
