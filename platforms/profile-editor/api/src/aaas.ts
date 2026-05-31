import axios from "axios";
import { env } from "./env";

const USER_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440000";
const PROFESSIONAL_PROFILE_ONTOLOGY = "550e8400-e29b-41d4-a716-446655440009";

/**
 * Registers our `/api/webhook` as an AaaS subscription for the user and
 * professional-profile ontologies (idempotent — skips if one already targets
 * us). Logs and continues on failure so a down AaaS never blocks startup.
 */
export async function registerSubscriptionOnStartup(): Promise<void> {
    if (!env.awarenessApiKey) {
        console.warn(
            "[aaas] AWARENESS_API_KEY not set — skipping subscription registration",
        );
        return;
    }

    const targetUrl =
        env.awarenessWebhookUrl ||
        `${env.baseUrl.replace(/\/$/, "")}/api/webhook`;
    const headers = { Authorization: `Bearer ${env.awarenessApiKey}` };
    const base = env.awarenessServiceUrl.replace(/\/$/, "");

    try {
        const { data } = await axios.get<{
            subscriptions: Array<{ targetUrl: string }>;
        }>(`${base}/api/subscriptions`, { headers, timeout: 10000 });

        if (data.subscriptions?.some((s) => s.targetUrl === targetUrl)) {
            console.log("[aaas] subscription already registered");
            return;
        }

        await axios.post(
            `${base}/api/subscriptions`,
            {
                targetUrl,
                ontologyFilter: [USER_ONTOLOGY, PROFESSIONAL_PROFILE_ONTOLOGY],
                evaultFilter: [],
            },
            { headers, timeout: 10000 },
        );
        console.log(`[aaas] subscription registered -> ${targetUrl}`);
    } catch (error) {
        const message = axios.isAxiosError(error)
            ? (error.response?.data?.error ?? error.message)
            : (error as Error).message;
        console.error(
            "[aaas] subscription registration failed (continuing):",
            message,
        );
    }
}
