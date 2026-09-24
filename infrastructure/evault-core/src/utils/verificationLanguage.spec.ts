import { describe, expect, it } from "vitest";
import { verificationLanguage } from "./verificationLanguage";

describe("verificationLanguage", () => {
	it.each(["en", "ru", "uk", "pt-BR"])("passes %s through", (code) => {
		expect(verificationLanguage(code)).toBe(code);
	});

	it.each([undefined, null, "", "english", "RU", "r", 42, {}])(
		"falls back to en for %s",
		(value) => {
			expect(verificationLanguage(value)).toBe("en");
		},
	);
});
