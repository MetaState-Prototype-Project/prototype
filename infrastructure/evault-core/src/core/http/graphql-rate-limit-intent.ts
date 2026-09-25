import { Kind, parse } from "graphql";

type GraphQLBody = {
    query?: unknown;
    operationName?: unknown;
};

function graphQLBody(value: unknown): GraphQLBody | null {
    return value && typeof value === "object" && !Array.isArray(value)
        ? (value as GraphQLBody)
        : null;
}

/**
 * Returns true only when the request unambiguously selects a GraphQL query.
 * Mutations, subscriptions, malformed documents, and ambiguous batches must
 * remain on the stricter write budget.
 */
export function isGraphQLReadOperation(body: unknown): boolean {
    const input = graphQLBody(body);
    if (!input || typeof input.query !== "string") return false;
    try {
        const document = parse(input.query, { noLocation: true });
        const operations = document.definitions.filter(
            (definition) => definition.kind === Kind.OPERATION_DEFINITION,
        );
        const operationName =
            typeof input.operationName === "string" &&
            input.operationName.trim()
                ? input.operationName.trim()
                : undefined;
        const selected = operationName
            ? operations.find(
                  (operation) => operation.name?.value === operationName,
              )
            : operations.length === 1
              ? operations[0]
              : undefined;
        return selected?.operation === "query";
    } catch {
        return false;
    }
}
