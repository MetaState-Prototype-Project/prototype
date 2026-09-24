import { describe, expect, it } from "vitest";
import {
    CATALOG_FORMAT_VERSION,
    type RejectionReason,
    isTransportSafe,
    validateCatalog,
} from "./catalog";

// Real keys, so renaming one in messages/en.json fails these tests.
const PLAIN = "common_accept";
const WITH_PLACEHOLDER = "loggedin_connected_to"; // "...connected to {platform}"
const VARIANT = "onboarding_step_counter";

function catalog(messages: unknown, version: unknown = CATALOG_FORMAT_VERSION) {
    return validateCatalog({ version, messages });
}

function reasonFor(result: ReturnType<typeof validateCatalog>, key: string) {
    return result.rejected.find((r) => r.key === key)?.reason;
}

describe("validateCatalog", () => {
    it("accepts a correction for a shipped key", () => {
        const result = catalog({ ru: { [PLAIN]: "Принять" } });
        expect(result.accepted).toEqual({ ru: { [PLAIN]: "Принять" } });
        expect(result.rejected).toEqual([]);
    });

    it("keeps locales independent", () => {
        const result = catalog({
            ru: { [PLAIN]: "Принять" },
            uk: { [PLAIN]: "Прийняти" },
        });
        expect(result.accepted.ru?.[PLAIN]).toBe("Принять");
        expect(result.accepted.uk?.[PLAIN]).toBe("Прийняти");
    });

    it("discards the whole file on an unsupported version", () => {
        const result = catalog({ ru: { [PLAIN]: "Принять" } }, 99);
        expect(result.fatal).toBe("unsupported-version:99");
        expect(result.accepted).toEqual({});
    });

    it.each<[string, unknown, RejectionReason]>([
        ["an unknown key", { ru: { not_a_real_key: "x" } }, "unknown-key"],
        ["a plural message", { ru: { [VARIANT]: "x" } }, "variant-message"],
        ["a non-string value", { ru: { [PLAIN]: 42 } }, "not-a-string"],
    ])("refuses %s", (_label, messages, reason) => {
        const result = catalog(messages);
        expect(result.accepted).toEqual({});
        expect(result.rejected[0]?.reason).toBe(reason);
    });

    it("refuses an unknown locale without touching the valid ones", () => {
        const result = catalog({ fr: { [PLAIN]: "x" }, ru: { [PLAIN]: "ок" } });
        expect(reasonFor(result, "*")).toBe("unknown-locale");
        expect(result.accepted).toEqual({ ru: { [PLAIN]: "ок" } });
    });

    describe("placeholders", () => {
        it("accepts an override that preserves them", () => {
            const result = catalog({
                ru: { [WITH_PLACEHOLDER]: "Вы подключены к {platform}" },
            });
            expect(result.accepted.ru?.[WITH_PLACEHOLDER]).toContain(
                "{platform}",
            );
        });

        it("refuses one that drops them", () => {
            const result = catalog({
                ru: { [WITH_PLACEHOLDER]: "Вы подключены" },
            });
            expect(reasonFor(result, WITH_PLACEHOLDER)).toBe(
                "placeholder-mismatch",
            );
        });

        it("refuses one that invents them", () => {
            const result = catalog({ ru: { [PLAIN]: "Принять {token}" } });
            expect(reasonFor(result, PLAIN)).toBe("placeholder-mismatch");
        });
    });

    it.each([
        ["null", null],
        ["a string", "nope"],
        ["a file with no messages", { version: CATALOG_FORMAT_VERSION }],
    ])("discards %s", (_label, raw) => {
        const result = validateCatalog(raw);
        expect(result.fatal).toBeTruthy();
        expect(result.accepted).toEqual({});
    });

    it("treats an empty catalog as a rollback to the shipped strings", () => {
        const result = catalog({});
        expect(result.fatal).toBeUndefined();
        expect(result.accepted).toEqual({});
    });
});

describe("isTransportSafe", () => {
    it.each([
        "https://docs.w3ds.metastate.foundation/translations.json",
        "http://localhost:8787/translations.json",
        "http://127.0.0.1:8787/translations.json",
    ])("allows %s", (url) => {
        expect(isTransportSafe(url)).toBe(true);
    });

    it.each([
        "http://docs.w3ds.metastate.foundation/translations.json",
        "http://192.168.1.10/translations.json",
        "ftp://example.com/translations.json",
        "not a url",
    ])("refuses %s", (url) => {
        expect(isTransportSafe(url)).toBe(false);
    });
});
