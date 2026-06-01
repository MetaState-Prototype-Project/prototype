import type { Request, Response } from "express";
import type { Web3Adapter } from "web3-adapter";
import type { ProfessionalProfileService } from "../services/ProfessionalProfileService";
import type { UserService } from "../services/UserService";

/**
 * Inbound sync: AaaS delivers an eVault change here. We map it to local fields
 * via the adapter (fromGlobal), upsert the local row, record the id-mapping,
 * and lock the ids so the subscriber doesn't echo it straight back out.
 * Always 200 so AaaS doesn't dead-letter on a transient blip.
 */
export class WebhookController {
    constructor(
        private adapter: Web3Adapter,
        private users: UserService,
        private profiles: ProfessionalProfileService,
    ) {}

    handleWebhook = async (req: Request, res: Response) => {
        try {
            const { schemaId, id: globalId, w3id, data } = req.body ?? {};
            const mapping = Object.values(this.adapter.mapping).find(
                (m) => m.schemaId === schemaId,
            );
            if (!mapping || !globalId) return res.status(200).send();

            this.adapter.addToLockedIds(globalId);
            const local = await this.adapter.fromGlobal({ data, mapping });
            const ename: string | undefined =
                w3id ?? (local.data.ename as string | undefined);
            if (!ename) return res.status(200).send();

            let localId: string | undefined;
            if (mapping.tableName === "users") {
                const user = await this.users.upsertFromGlobal(
                    ename,
                    local.data,
                );
                localId = user.id;
            } else if (mapping.tableName === "professional_profiles") {
                const profile = await this.profiles.upsertFromGlobal(
                    ename,
                    local.data,
                );
                localId = profile.id;
            } else {
                return res.status(200).send();
            }

            this.adapter.addToLockedIds(localId);
            this.adapter.addToLockedIds(globalId);
            await this.adapter.mappingDb.storeMapping({ localId, globalId });

            res.status(200).send();
        } catch (error) {
            // Genuine processing failure (e.g. DB blip): 500 so AaaS retries
            // and eventually dead-letters, rather than silently losing the
            // change. Non-retryable skips above return 200.
            console.error("Webhook error:", (error as Error).message);
            res.status(500).send();
        }
    };
}
