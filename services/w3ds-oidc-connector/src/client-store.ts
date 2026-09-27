/**
 * Where OIDC clients live. Clients are created and managed by their owners
 * through the developer portal; the OIDC endpoints only ever read them.
 */

export interface ClientRecord {
    /** Internal row ID; never shown. */
    id: string;
    /** The public client ID IdPs are configured with. */
    clientId: string;
    secretHash: string;
    name: string;
    /** The eName that created the client and alone may manage it. */
    ownerEName: string;
    redirectUris: string[];
    /** Adds `email: <user>@w3ds.invalid` for IdPs that require one. */
    syntheticEmail: boolean;
    /** Shown on the login page and passed to the wallet; https only. */
    logoUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    secretRotatedAt: Date;
    lastUsedAt: Date | null;
}

export interface NewClient {
    clientId: string;
    secretHash: string;
    name: string;
    ownerEName: string;
    redirectUris: string[];
    syntheticEmail: boolean;
    logoUrl: string | null;
}

export interface ClientChanges {
    name: string;
    redirectUris: string[];
    syntheticEmail: boolean;
    logoUrl: string | null;
}

export type ClientAction = "created" | "updated" | "secret_rotated" | "deleted";

/**
 * Every method that takes an owner is scoped to that owner: another eName's
 * client behaves exactly as if it did not exist.
 */
export interface ClientRepository {
    findByClientId(clientId: string): Promise<ClientRecord | null>;
    findOwned(owner: string, clientId: string): Promise<ClientRecord | null>;
    listByOwner(owner: string): Promise<ClientRecord[]>;
    create(client: NewClient): Promise<ClientRecord>;
    update(
        owner: string,
        clientId: string,
        changes: ClientChanges,
    ): Promise<ClientRecord | null>;
    rotateSecret(
        owner: string,
        clientId: string,
        secretHash: string,
    ): Promise<ClientRecord | null>;
    delete(owner: string, clientId: string): Promise<boolean>;
    /** Clients `owner` has created since `since`, deleted ones included. */
    countCreatedSince(owner: string, since: Date): Promise<number>;
    touchLastUsed(clientId: string, at: Date): Promise<void>;
}
