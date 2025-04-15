import { v4 as uuidv4, v5 as uuidv5 } from "uuid";

/**
 * Generates a UUIDv5 taking namespace from a random UUIDv4 and taking `name`
 * part as entropy from the creator of the identifier
 *
 * @param {String} entropy
 * @param {String} namespace - uuid namespace
 * @returns string
 */

export function generateUuid(
    entropy: string,
    namespace: string = uuidv4(),
): string {
    return uuidv5(entropy, namespace);
}
