import { describe, expect, it, vi } from "vitest";
import { fill } from "./catalog";
import { type Lookup, type MessageFn, createMessages } from "./wrap";

// Typed as MessageFn so the fakes take the same (inputs, options) pair.
const compiled: { greeting: MessageFn; connected: MessageFn } = {
    greeting: () => "Hello",
    connected: (inputs) => `Connected to ${inputs?.platform}`,
};

function build(
    overrides: Record<string, Record<string, string>> = {},
    locale = "ru",
) {
    const lookup: Lookup = (loc, key) => overrides[loc]?.[key];
    return createMessages(compiled, () => locale, lookup);
}

describe("createMessages", () => {
    it("falls through to the compiled string when nothing overrides it", () => {
        expect(build().greeting()).toBe("Hello");
    });

    it("prefers a correction for the active locale", () => {
        expect(build({ ru: { greeting: "Привет" } }).greeting()).toBe("Привет");
    });

    it("ignores a correction aimed at a different locale", () => {
        expect(build({ uk: { greeting: "Привіт" } }, "ru").greeting()).toBe(
            "Hello",
        );
    });

    it("honours an explicit locale option over the ambient one", () => {
        const m = build({ uk: { greeting: "Привіт" } }, "ru");
        expect(m.greeting(undefined, { locale: "uk" })).toBe("Привіт");
    });

    it("fills placeholders in a correction", () => {
        const m = build({ ru: { connected: "Вы подключены к {platform}" } });
        expect(m.connected({ platform: "Pictique" })).toBe(
            "Вы подключены к Pictique",
        );
    });

    it("passes inputs through to the compiled message when not overridden", () => {
        expect(build().connected({ platform: "Blabsy" })).toBe(
            "Connected to Blabsy",
        );
    });

    it("reports an unknown key as undefined rather than throwing", () => {
        expect(
            (build() as unknown as Record<string, unknown>).nope,
        ).toBeUndefined();
    });

    it("reuses one wrapper per key across accesses", () => {
        const m = build();
        expect(m.greeting).toBe(m.greeting);
    });

    it("re-reads the override on every call, so a late fetch takes effect", () => {
        const lookup = vi.fn<Lookup>(() => undefined);
        const m = createMessages(compiled, () => "ru", lookup);
        expect(m.greeting()).toBe("Hello");
        lookup.mockReturnValue("Привет");
        expect(m.greeting()).toBe("Привет");
    });
});

describe("fill", () => {
    it("returns the template untouched when there are no inputs", () => {
        expect(fill("Connected to {platform}")).toBe("Connected to {platform}");
    });

    it("leaves a placeholder the inputs do not cover", () => {
        expect(fill("{a} and {b}", { a: "1" })).toBe("1 and {b}");
    });

    it("stringifies non-string inputs", () => {
        expect(fill("{count} left", { count: 3 })).toBe("3 left");
    });
});
