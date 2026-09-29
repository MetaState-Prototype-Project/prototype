import type { Profile } from "./profile.js";

/** Authentication method references (RFC 8176) the connector can assert. */
export type Amr = "hwk" | "swk";

/** What a verified wallet signature proves about the browser's user. */
export interface Identity {
    /** The eName, with its leading `@`. */
    eName: string;
    amr: Amr[];
    /** Seconds since the epoch. */
    authTime: number;
    /**
     * What the user's eVault profile says about them. Self-asserted, so it
     * describes the user but never identifies them.
     */
    profile?: Profile;
}

/** The parameters of a validated /authorize request, carried to /token. */
export interface AuthorizationRequest {
    clientId: string;
    redirectUri: string;
    state?: string;
    nonce?: string;
    codeChallenge: string;
    scope: string[];
}
