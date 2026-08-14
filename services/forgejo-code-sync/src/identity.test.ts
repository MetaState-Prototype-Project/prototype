import { describe, expect, it } from "vitest";
import { enameFromLoginName } from "./identity.js";

describe("enameFromLoginName", () => {
    it("returns the ename when login_name starts with @", () => {
        expect(enameFromLoginName("@alice")).toBe("@alice");
        expect(enameFromLoginName("@user-a.w3id")).toBe("@user-a.w3id");
    });

    it("returns null for an ordinary password account's login_name", () => {
        expect(enameFromLoginName("alice")).toBeNull();
    });

    it("returns null for an empty string", () => {
        expect(enameFromLoginName("")).toBeNull();
    });

    it("returns null when @ appears but not as the first character", () => {
        // Not a real GitW3 login_name shape, but the check is a strict prefix
        // check, not a "contains @" check - worth pinning down explicitly.
        expect(enameFromLoginName("foo@bar")).toBeNull();
    });
});
