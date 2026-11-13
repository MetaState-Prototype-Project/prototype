import { describe, expect, it } from "vitest";
import {
    cleanPlatformLogo,
    cleanPlatformName,
    readPlatformBranding,
} from "./platformBranding";

const RLO = String.fromCodePoint(0x202e); // right-to-left override
const ZWSP = String.fromCodePoint(0x200b); // zero-width space
const NEWLINE = String.fromCodePoint(0x0a);

describe("cleanPlatformName", () => {
    it("keeps an ordinary name", () => {
        expect(cleanPlatformName("Acme Corp SSO")).toBe("Acme Corp SSO");
    });

    it("trims and collapses whitespace", () => {
        expect(cleanPlatformName(`  Acme${NEWLINE}  Corp  `)).toBe("Acme Corp");
    });

    it("removes invisible and direction-changing characters", () => {
        expect(cleanPlatformName(`Acme${RLO}gnp.${ZWSP}exe`)).toBe(
            "Acmegnp.exe",
        );
    });

    it("treats missing or blank names as absent", () => {
        expect(cleanPlatformName(null)).toBeNull();
        expect(cleanPlatformName("")).toBeNull();
        expect(cleanPlatformName(`  ${ZWSP} `)).toBeNull();
    });

    it("caps long names at 64 characters", () => {
        const name = cleanPlatformName("a".repeat(200));
        expect(Array.from(name ?? "")).toHaveLength(64);
        expect(name?.endsWith("…")).toBe(true);
    });
});

describe("cleanPlatformLogo", () => {
    it("accepts an https URL", () => {
        expect(cleanPlatformLogo("https://cdn.example/logo.png")).toBe(
            "https://cdn.example/logo.png",
        );
    });

    it.each([
        "http://cdn.example/logo.png",
        "javascript:alert(1)",
        "data:image/png;base64,AAAA",
        "https://user:pass@cdn.example/logo.png",
        "not a url",
        `https://cdn.example/${"a".repeat(2100)}`,
    ])("rejects %s", (logo) => {
        expect(cleanPlatformLogo(logo)).toBeNull();
    });
});

describe("readPlatformBranding", () => {
    it("reads name and logo from a w3ds://auth link", () => {
        const url = new URL(
            "w3ds://auth?redirect=https%3A%2F%2Foidc.example%2Fw3ds%2Fcallback&session=s&platform=Acme&name=Acme+Corp&logo=https%3A%2F%2Fcdn.example%2Flogo.png",
        );
        expect(readPlatformBranding(url.searchParams)).toEqual({
            name: "Acme Corp",
            logo: "https://cdn.example/logo.png",
        });
    });

    it("returns nothing for links without branding", () => {
        const url = new URL(
            "w3ds://auth?redirect=https%3A%2F%2Fblabsy.example%2Fapi%2Fauth&session=s&platform=blabsy",
        );
        expect(readPlatformBranding(url.searchParams)).toEqual({
            name: null,
            logo: null,
        });
    });
});
