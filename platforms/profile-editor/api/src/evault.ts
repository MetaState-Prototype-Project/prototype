import { EVaultClient } from "web3-adapter";
import { env } from "./env";
import type { Payload } from "./ontology";

/**
 * Write side of the W3DS-native profile editor: everything is written straight
 * to the owner's eVault via GraphQL. The shared EVaultClient resolves the
 * eVault URL + platform token from the registry and retries on transient
 * failures. No local state is kept.
 */
export class EvaultWriter {
    private client = new EVaultClient(env.registryUrl, env.baseUrl);

    /**
     * Upsert one MetaEnvelope. With an existing id we update in place; without
     * one we create and return the new id. eVault `update` replaces the whole
     * payload, so callers pass the fully-merged payload.
     */
    async upsertEnvelope(
        ename: string,
        ontology: string,
        existingId: string | null,
        payload: Payload,
    ): Promise<string> {
        const envelope = { schemaId: ontology, data: payload, w3id: ename };
        if (existingId) {
            await this.client.updateMetaEnvelopeById(existingId, envelope);
            return existingId;
        }
        return this.client.storeMetaEnvelope(envelope);
    }

    /**
     * Upload a file to the eVault's blob storage and return its public URL —
     * that URL is what gets stored in the profile (images as URIs, no blobs).
     */
    async uploadBlob(
        ename: string,
        file: { filename: string; contentType: string; base64: string },
    ): Promise<string> {
        const result = await this.client.uploadFile(ename, {
            filename: file.filename,
            contentType: file.contentType,
            content: file.base64,
            acl: ["*"],
        });
        return result.publicUrl;
    }
}
