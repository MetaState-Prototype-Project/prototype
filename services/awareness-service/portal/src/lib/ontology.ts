/**
 * Client for the ontology service, which serves the catalogue of MetaEnvelope
 * schemas. Used to make ontologies selectable in the subscription UI.
 */
export const ONTOLOGY_BASE = "https://ontology.w3ds.metastate.foundation";

export interface OntologySchema {
    /** The schemaId (UUID) — this is what AaaS stores as a packet's ontology. */
    id: string;
    title: string;
}

/** Fetches the full list of available ontologies. */
export async function fetchSchemas(): Promise<OntologySchema[]> {
    const res = await fetch(`${ONTOLOGY_BASE}/schemas`);
    if (!res.ok) {
        throw new Error(`ontology service returned ${res.status}`);
    }
    const list = (await res.json()) as OntologySchema[];
    return list.map((s) => ({ id: s.id, title: s.title ?? s.id }));
}
