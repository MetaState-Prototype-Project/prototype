/**
 * The domains a platform can be granted access to.
 *
 * The list is owned by the ontology service, not by this app: every schema
 * declares the domain it belongs to, so granting a domain is what actually
 * decides which data a platform may touch. Fetched once and cached, with the
 * published list as the single source of truth.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { ontologyUrl } from "./env";
import type { Domain } from "$lib/types";

const TTL_MS = 30 * 60_000;

const STORE = Symbol.for("ppa.domains");
const store = globalThis as typeof globalThis & {
    [STORE]?: { at: number; domains: Domain[] } | null;
};

const SCHEMA_STORE = Symbol.for("ppa.ontologyDomains");
const schemaStore = globalThis as typeof globalThis & {
    [SCHEMA_STORE]?: { at: number; map: Map<string, string> } | null;
};

export async function listDomains(): Promise<Domain[]> {
    const cached = store[STORE];
    if (cached && Date.now() - cached.at < TTL_MS) return cached.domains;

    const url = new URL("/domains", ontologyUrl()).toString();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`ontology /domains returned ${res.status}`);
        const body = (await res.json()) as { domains?: Domain[] };
        const domains = (body.domains ?? []).filter(
            (d) => typeof d?.id === "string" && d.id,
        );
        store[STORE] = { at: Date.now(), domains };
        return domains;
    } catch (error) {
        console.warn(
            `[ppa/domains] ${url} did not serve a domain list (${error instanceof Error ? error.message : error}); reading the published file directly`,
        );
        // A reviewer with no domains to pick from cannot grant anything, so
        // fall back rather than render an empty form. This is the same file
        // the ontology service publishes, not a second copy of the list — it
        // covers the window before a deployment picks the endpoint up.
        const fromDisk = await readPublishedFile();
        if (fromDisk.length > 0) {
            store[STORE] = { at: Date.now(), domains: fromDisk };
            return fromDisk;
        }
        return cached?.domains ?? [];
    }
}

/**
 * Reads the list out of the published Domain schema in the workspace — the
 * same file the ontology service serves, so this is the same list rather than
 * a second copy of it. Each permitted value carries its own title and
 * description, which is how a JSON Schema enum names its options.
 */
async function readPublishedFile(): Promise<Domain[]> {
    // cwd is services/ppa under both `vite dev` and `node build/index.js`.
    const file = path.resolve(process.cwd(), "../ontology/schemas/domain.json");
    try {
        const schema = JSON.parse(await readFile(file, "utf8")) as {
            properties?: {
                id?: {
                    oneOf?: Array<{
                        const?: string;
                        title?: string;
                        description?: string;
                    }>;
                };
            };
        };
        const options = schema.properties?.id?.oneOf ?? [];
        return options
            .filter((o): o is { const: string; title?: string; description?: string } =>
                typeof o.const === "string",
            )
            .map((o) => ({
                id: o.const,
                label: o.title ?? o.const,
                description: o.description ?? "",
            }));
    } catch (error) {
        console.error(`[ppa/domains] could not read ${file}:`, error);
        return [];
    }
}

/**
 * Which domain each ontology belongs to. A platform declares the ontologies it
 * uses; the domains it is asking for are the domains those ontologies fall
 * under, so this is the map that turns a self-description into a request.
 */
export async function ontologyDomains(): Promise<Map<string, string>> {
    const cached = schemaStore[SCHEMA_STORE];
    if (cached && Date.now() - cached.at < TTL_MS) return cached.map;

    const url = new URL("/schemas", ontologyUrl()).toString();
    let entries: Array<[string, string]> = [];
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`ontology /schemas returned ${res.status}`);
        const body = (await res.json()) as Array<{ id?: string; domain?: string }>;
        entries = body
            .filter((x) => typeof x.id === "string" && typeof x.domain === "string")
            .map((x) => [x.id as string, x.domain as string]);
    } catch (error) {
        console.warn(
            `[ppa/domains] ${url} unavailable (${error instanceof Error ? error.message : error}); reading published schemas directly`,
        );
        entries = await readSchemaDomainsFromDisk();
    }

    const map = new Map(entries);
    if (map.size > 0) schemaStore[SCHEMA_STORE] = { at: Date.now(), map };
    return map.size > 0 ? map : (cached?.map ?? new Map());
}

/** Reads every published schema in the workspace for its domain tag. */
async function readSchemaDomainsFromDisk(): Promise<Array<[string, string]>> {
    const dir = path.resolve(process.cwd(), "../ontology/schemas");
    try {
        const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
        const out: Array<[string, string]> = [];
        for (const file of files) {
            try {
                const schema = JSON.parse(
                    await readFile(path.join(dir, file), "utf8"),
                ) as { schemaId?: string; domain?: string };
                if (schema.schemaId && schema.domain) {
                    out.push([schema.schemaId, schema.domain]);
                }
            } catch {
                // A single unreadable schema must not blank the whole map.
            }
        }
        return out;
    } catch (error) {
        console.error(`[ppa/domains] could not read ${dir}:`, error);
        return [];
    }
}

/** Keeps only ids that exist in the published list, preserving its order. */
export async function validDomains(requested: string[]): Promise<string[]> {
    const known = await listDomains();
    const wanted = new Set(requested);
    return known.filter((d) => wanted.has(d.id)).map((d) => d.id);
}
