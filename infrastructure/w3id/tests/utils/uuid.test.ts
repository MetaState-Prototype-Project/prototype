import falso from "@ngneat/falso";
import { describe, expect, test } from "vitest";
import { generateUuid } from "../../src/utils/uuid";

describe("UUIDv5 Generation", () => {
    test("Create UUID", () => {
        const id = generateUuid(falso.randText());
        expect(id).toBeDefined();
    });

    test("UUID is deterministic", () => {
        const namespace = falso.randUuid();
        const entropy = falso.randText();
        const id = generateUuid(entropy, namespace);
        const id2 = generateUuid(entropy, namespace);
        expect(id).toEqual(id2);
    });

    test("UUID Bad Namespace", () => {
        const namespace = falso.randText();
        const entropy = falso.randText();
        expect(() => generateUuid(entropy, namespace)).toThrowError(
            "Invalid UUID",
        );
    });
});
