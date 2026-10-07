import {
    BINDING_DOCUMENT_ONTOLOGY,
    COMPANY_ONTOLOGY,
    DELEGATED_SIGNATURE_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    ROLE_ONTOLOGY,
    SHAREHOLDING_ONTOLOGY,
    USER_PROFILE_ONTOLOGY,
} from "./ontologies";

/**
 * What a delegate may sign for a company: `ontology:<schemaId>` for records of
 * an ontology, or `@<platform-eName>:<keyword>` for a document type a platform
 * declares itself.
 */
export type Scope = string;

export type ParsedScope =
    | { kind: "ontology"; ontology: string }
    | { kind: "platform"; platform: string; keyword: string };

const ONTOLOGY_SCOPE =
    /^ontology:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const PLATFORM_SCOPE = /^(@[^\s:]+):([a-z][a-z0-9-]*)$/;

/**
 * Ontologies that describe the company's own authority or a person's
 * identity. Signing for them on someone else's behalf is never allowed.
 */
export const CORE_ONTOLOGIES: readonly string[] = [
    USER_PROFILE_ONTOLOGY,
    BINDING_DOCUMENT_ONTOLOGY,
    COMPANY_ONTOLOGY,
    SHAREHOLDING_ONTOLOGY,
    ROLE_ONTOLOGY,
    DELEGATION_ONTOLOGY,
    DELEGATED_SIGNATURE_ONTOLOGY,
];

/**
 * Protocol-level acts (login, key and eVault management) are reserved to the
 * `@w3ds` namespace so no platform can declare a keyword that stands for them.
 */
export const CORE_NAMESPACE = "@w3ds";

export function parseScope(scope: unknown): ParsedScope | null {
    if (typeof scope !== "string") return null;
    const ontology = ONTOLOGY_SCOPE.exec(scope);
    if (ontology) {
        return { kind: "ontology", ontology: ontology[1].toLowerCase() };
    }
    const platform = PLATFORM_SCOPE.exec(scope);
    if (platform) {
        return {
            kind: "platform",
            platform: platform[1],
            keyword: platform[2],
        };
    }
    return null;
}

/** Normalises a scope so equal scopes compare equal (ontology ids lowercase). */
export function normaliseScope(scope: Scope): Scope | null {
    const parsed = parseScope(scope);
    if (!parsed) return null;
    return parsed.kind === "ontology"
        ? `ontology:${parsed.ontology}`
        : `${parsed.platform}:${parsed.keyword}`;
}

/** True for scopes no role or delegation may ever include. */
export function isCoreScope(scope: Scope): boolean {
    const parsed = parseScope(scope);
    if (!parsed) return false;
    if (parsed.kind === "ontology") {
        return CORE_ONTOLOGIES.includes(parsed.ontology);
    }
    return parsed.platform.toLowerCase() === CORE_NAMESPACE;
}

export type ScopeListProblem =
    | { code: "EMPTY" }
    | { code: "INVALID_SCOPE"; scope: unknown }
    | { code: "CORE_SCOPE"; scope: Scope };

/** Checks a role's or delegation's scope list; returns the first problem. */
export function checkScopes(scopes: unknown): ScopeListProblem | null {
    if (!Array.isArray(scopes) || scopes.length === 0) return { code: "EMPTY" };
    for (const scope of scopes) {
        if (!parseScope(scope)) return { code: "INVALID_SCOPE", scope };
        if (isCoreScope(scope)) return { code: "CORE_SCOPE", scope };
    }
    return null;
}

/** Whether every scope in `child` is also in `parent`. */
export function isScopeSubset(child: Scope[], parent: Scope[]): boolean {
    const allowed = new Set(parent.map(normaliseScope));
    return child.every((s) => {
        const n = normaliseScope(s);
        return n !== null && allowed.has(n);
    });
}
