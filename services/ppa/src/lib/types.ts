/**
 * Types shared between server code and components. Lives outside $lib/server
 * because SvelteKit refuses to pull a server-only module into a component,
 * type-only import or not.
 */

/** A domain of data, as published by the ontology service. */
export interface Domain {
    id: string;
    label: string;
    description: string;
}
