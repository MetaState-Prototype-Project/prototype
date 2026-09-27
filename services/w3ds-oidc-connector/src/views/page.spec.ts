import { describe, expect, it } from "vitest";
import { escapeHtml, scriptJson } from "./page.js";

describe("escaping", () => {
    it("escapes HTML metacharacters", () => {
        expect(escapeHtml(`<a href="x">'&'</a>`)).toBe(
            "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;",
        );
    });

    it("keeps embedded JSON from closing its script element", () => {
        const json = scriptJson({ v: "</script><script>alert(1)</script>" });
        expect(json).not.toMatch(/[<>]/);
        expect(JSON.parse(json)).toEqual({
            v: "</script><script>alert(1)</script>",
        });
    });

    it("escapes line separators and other non-ASCII", () => {
        const value = `a${String.fromCharCode(0x2028)}b${String.fromCharCode(0x2029)}é`;
        const json = scriptJson({ value });
        expect(json).toMatch(/^[ -~]*$/);
        expect(JSON.parse(json)).toEqual({ value });
    });
});
