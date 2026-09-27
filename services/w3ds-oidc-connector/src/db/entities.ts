/**
 * Table definitions as EntitySchemas rather than decorated classes: this
 * package is ESM and run with tsx, which cannot emit decorator metadata.
 */

import { EntitySchema } from "typeorm";
import type { ClientAction } from "../client-store.js";

export interface ClientRow {
    id: string;
    client_id: string;
    secret_hash: string;
    name: string;
    owner_ename: string;
    redirect_uris: string[];
    synthetic_email: boolean;
    logo_url: string | null;
    created_at: Date;
    updated_at: Date;
    secret_rotated_at: Date;
    last_used_at: Date | null;
}

export interface ClientEventRow {
    id: string;
    owner_ename: string;
    client_id: string;
    action: ClientAction;
    at: Date;
}

export const ClientEntity = new EntitySchema<ClientRow>({
    name: "OidcClient",
    tableName: "oidc_clients",
    columns: {
        id: { type: "uuid", primary: true, generated: "uuid" },
        client_id: { type: "text", unique: true },
        secret_hash: { type: "text" },
        name: { type: "text" },
        owner_ename: { type: "text" },
        redirect_uris: { type: "jsonb" },
        synthetic_email: { type: "boolean", default: false },
        logo_url: { type: "text", nullable: true },
        created_at: { type: "timestamptz", createDate: true },
        updated_at: { type: "timestamptz", updateDate: true },
        secret_rotated_at: { type: "timestamptz", default: () => "now()" },
        last_used_at: { type: "timestamptz", nullable: true },
    },
    indices: [{ name: "idx_oidc_clients_owner", columns: ["owner_ename"] }],
});

export const ClientEventEntity = new EntitySchema<ClientEventRow>({
    name: "OidcClientEvent",
    tableName: "oidc_client_events",
    columns: {
        id: { type: "uuid", primary: true, generated: "uuid" },
        owner_ename: { type: "text" },
        client_id: { type: "text" },
        action: { type: "text" },
        at: { type: "timestamptz", createDate: true },
    },
    indices: [
        {
            name: "idx_oidc_client_events_owner_action_at",
            columns: ["owner_ename", "action", "at"],
        },
    ],
});
