import { describe, expect, it } from "vitest";
import { verificationLanguage } from "./verificationLanguage";

describe("verificationLanguage", () => {
	it.each(["en", "ru", "uk", "pt-BR", "zh-TW"])(
		"passes the supported code %s through",
		(code) => {
			expect(verificationLanguage(code)).toBe(code);
		},
	);

	// Well-formed but not offered by Didit. Forwarding these risks a rejected
	// session, which would stop verification starting at all.
	it.each(["es-MX", "zz", "en-GB", "uk-UA"])(
		"falls back to en for the unsupported code %s",
		(code) => {
			expect(verificationLanguage(code)).toBe("en");
		},
	);

	it.each([undefined, null, "", "english", "RU", 42, {}])(
		"falls back to en for %s",
		(value) => {
			expect(verificationLanguage(value)).toBe("en");
		},
	);
});
