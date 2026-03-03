/**
 * W3DS Gateway — Types
 */

/** A platform that is registered in the W3DS ecosystem */
export interface Platform {
    /** Display name shown in the gateway chooser */
    name: string;
    /** Unique key identifier (lowercase, e.g. "pictique", "blabsy") */
    key: string;
    /** Base URL of the platform frontend (resolved at runtime from Registry or env) */
    baseUrl: string;
    /** Optional icon URL or icon key for UI rendering */
    icon?: string;
    /** Optional description of the platform */
    description?: string;
}

/** Describes how a specific platform handles a specific schema type */
export interface PlatformHandler {
    /** Platform key (matches Platform.key) */
    platformKey: string;
    /** Display name of the platform */
    platformName: string;
    /**
     * URL template with placeholders:
     *   {baseUrl}   — platform base URL
     *   {entityId}  — the ID of the entity to open
     *   {ename}     — the eName (W3ID) related to the entity
     */
    urlTemplate: string;
    /** Human-readable label for this action (e.g. "View post", "Open chat") */
    label: string;
    /** Optional icon key */
    icon?: string;
}

/** A resolved app option ready to be displayed in the chooser */
export interface ResolvedApp {
    /** Platform display name */
    platformName: string;
    /** Platform key */
    platformKey: string;
    /** The concrete URL the user can navigate to */
    url: string;
    /** Action label (e.g. "View post on Pictique") */
    label: string;
    /** Optional icon */
    icon?: string;
}

/** Input required to resolve an eName to application URLs */
export interface GatewayResolveInput {
    /** The eName (W3ID) to resolve */
    ename: string;
    /** The ontology schema ID indicating the type of content */
    schemaId: string;
    /** The entity ID (local or global) of the specific resource */
    entityId?: string;
}

/** Result from the gateway resolver */
export interface GatewayResolveResult {
    /** The eName that was resolved */
    ename: string;
    /** Schema ID that was looked up */
    schemaId: string;
    /** Human-readable label for the schema type */
    schemaLabel: string;
    /** List of applications that can handle this content */
    apps: ResolvedApp[];
}
