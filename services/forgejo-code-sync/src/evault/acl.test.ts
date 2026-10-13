import { describe, expect, it } from "vitest";
import { deriveAcl } from "./acl.js";

describe("deriveAcl", () => {
    it("returns [eName] for a private repo", () => {
        expect(deriveAcl(true, "@alice")).toEqual(["@alice"]);
    });

    it('returns ["*"] for a public repo', () => {
        expect(deriveAcl(false, "@alice")).toEqual(["*"]);
    });

    it("does not fall back to a public ACL when eName is oddly shaped", () => {
        // Not expected in practice (identity resolution already validated the
        // ename before this is called), but the derivation itself must stay a
        // pure function of repoIsPrivate - it must never silently widen access.
        expect(deriveAcl(true, "")).toEqual([""]);
    });
});
