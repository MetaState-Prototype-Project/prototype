import axios from "axios";
import { env } from "./env";
import {
    type Payload,
    PROFESSIONAL_PROFILE_ONTOLOGY,
    USER_ONTOLOGY,
} from "./ontology";

/** A single packet as returned by AaaS `GET /api/packets`. */
export interface Packet {
    id: string;
    ontology: string;
    w3id: string | null;
    data: Payload | null;
    receivedAt: string;
}

interface PacketsResponse {
    packets: Packet[];
    hasMore: boolean;
    nextCursor: string | null;
}

/** The current envelope (id + payload) for one ontology. */
export interface EnvelopeState {
    id: string;
    data: Payload;
}

/**
 * Read side of the W3DS-native profile editor: everything is pulled from
 * Awareness-as-a-Service. Each MetaEnvelope maps to exactly one packet (AaaS
 * upserts by envelope id), so filtering by eVault + ontology yields the current
 * state.
 */
export class AaasClient {
    private base = env.awarenessServiceUrl.replace(/\/$/, "");
    private headers = { Authorization: `Bearer ${env.awarenessApiKey}` };

    /** One page of packets for the given filters. */
    private async page(
        params: Record<string, string | number>,
        cursor?: string | null,
    ): Promise<PacketsResponse> {
        const { data } = await axios.get<PacketsResponse>(
            `${this.base}/api/packets`,
            {
                headers: this.headers,
                params: { limit: 200, ...params, ...(cursor ? { cursor } : {}) },
                timeout: 15000,
            },
        );
        return data;
    }

    /** Every packet matching the filters, paged to exhaustion (newest last). */
    private async all(
        params: Record<string, string | number>,
    ): Promise<Packet[]> {
        const out: Packet[] = [];
        let cursor: string | null | undefined;
        do {
            const res = await this.page(params, cursor);
            out.push(...(res.packets ?? []));
            cursor = res.hasMore ? res.nextCursor : null;
        } while (cursor);
        return out;
    }

    /** Latest envelope state per ontology for a single eVault (by eName). */
    async getProfileEnvelopes(ename: string): Promise<{
        user: EnvelopeState | null;
        professional: EnvelopeState | null;
    }> {
        const packets = await this.all({
            evault: ename,
            ontology: `${USER_ONTOLOGY},${PROFESSIONAL_PROFILE_ONTOLOGY}`,
        });

        // Packets are ordered oldest→newest, so the last write wins.
        let user: EnvelopeState | null = null;
        let professional: EnvelopeState | null = null;
        for (const p of packets) {
            if (!p.data) continue;
            if (p.ontology === USER_ONTOLOGY) {
                user = { id: p.id, data: p.data };
            } else if (p.ontology === PROFESSIONAL_PROFILE_ONTOLOGY) {
                professional = { id: p.id, data: p.data };
            }
        }
        return { user, professional };
    }

    /**
     * All User + Professional-Profile envelopes across every eVault, keyed by
     * eName — the cross-user source for discovery (no single eVault has them).
     */
    async listAllProfiles(): Promise<
        Map<string, { user: Payload | null; professional: Payload | null }>
    > {
        const packets = await this.all({
            ontology: `${USER_ONTOLOGY},${PROFESSIONAL_PROFILE_ONTOLOGY}`,
        });

        const byEname = new Map<
            string,
            { user: Payload | null; professional: Payload | null }
        >();
        for (const p of packets) {
            const ename = p.w3id ?? (p.data?.ename as string | undefined);
            if (!ename || !p.data) continue;
            const entry = byEname.get(ename) ?? { user: null, professional: null };
            if (p.ontology === USER_ONTOLOGY) entry.user = p.data;
            else if (p.ontology === PROFESSIONAL_PROFILE_ONTOLOGY) {
                entry.professional = p.data;
            }
            byEname.set(ename, entry);
        }
        return byEname;
    }
}
