import { describe, expect, it } from "vitest";
import { buildClaims, sanitiseUsername } from "./claims.js";

const options = { emailDomain: "w3ds.invalid" };
const claimsFor = (ename: string, extra: string[] = []) =>
    buildClaims(ename, { ...options, extraReservedUsernames: extra });

describe("sanitiseUsername", () => {
    it("drops the leading @", () => {
        expect(sanitiseUsername("@alice")).toBe("alice");
    });

    it("keeps dots, hyphens and underscores inside the name", () => {
        expect(sanitiseUsername("@user-a.w3id")).toBe("user-a.w3id");
        expect(sanitiseUsername("@user_a")).toBe("user_a");
    });

    it("preserves case", () => {
        // Forgejo stores the name as given and compares on LowerName, so
        // lowercasing would gain nothing and lose legibility.
        expect(sanitiseUsername("@Alice")).toBe("Alice");
    });

    it("strips a leading separator, which a username may not start with", () => {
        expect(sanitiseUsername("@_bob")).toBe("bob");
        expect(sanitiseUsername("@-bob")).toBe("bob");
        expect(sanitiseUsername("@.bob")).toBe("bob");
    });

    it("strips a trailing separator", () => {
        expect(sanitiseUsername("@bob-")).toBe("bob");
        expect(sanitiseUsername("@bob.")).toBe("bob");
    });

    it("collapses runs of separators, which the negative pattern forbids", () => {
        expect(sanitiseUsername("@ali..ce")).toBe("ali-ce");
        expect(sanitiseUsername("@ali--ce")).toBe("ali-ce");
        expect(sanitiseUsername("@ali._-ce")).toBe("ali-ce");
    });

    it("replaces characters outside the allowed set", () => {
        expect(sanitiseUsername("@ali ce")).toBe("ali-ce");
        expect(sanitiseUsername("@ali+ce")).toBe("ali-ce");
        expect(sanitiseUsername("@ali/ce")).toBe("ali-ce");
    });

    it("folds diacritics rather than mangling them", () => {
        // Forgejo does the same (removeDiacriticsTransform), and replacing the
        // accent with a hyphen instead would silently truncate the name.
        expect(sanitiseUsername("@josé")).toBe("jose");
        expect(sanitiseUsername("@ÅSA")).toBe("ASA");
        expect(sanitiseUsername("@straße")).toBe("strasse");
    });

    it("removes an interior @, which would otherwise reach getUserName", () => {
        // Under USERNAME = preferred_username, Forgejo splits on @ and keeps the
        // part before it. Nothing may reach it containing one.
        expect(sanitiseUsername("@alice@example.org")).toBe(
            "alice-example.org",
        );
    });

    describe("length", () => {
        it("truncates to 40 characters", () => {
            expect(sanitiseUsername(`@${"a".repeat(60)}`)).toBe("a".repeat(40));
        });

        it("re-strips the tail when truncation lands on a separator", () => {
            const ename = `@${"a".repeat(39)}-${"b".repeat(20)}`;
            expect(sanitiseUsername(ename)).toBe("a".repeat(39));
        });

        it("leaves a name of exactly 40 alone", () => {
            expect(sanitiseUsername(`@${"a".repeat(40)}`)).toBe("a".repeat(40));
        });
    });

    describe("names Forgejo will not accept", () => {
        it.each([
            "api",
            "admin",
            "explore",
            "login",
            "user",
            "ghost",
            "forgejo-actions",
            "favicon.ico",
            "swagger.v1.json",
        ])("falls back for the reserved name %s", (name) => {
            expect(sanitiseUsername(`@${name}`)).toBe("");
        });

        it("matches the reserved list case-insensitively", () => {
            // Forgejo lower-cases before comparing (models/db/name.go:113), so a
            // case-sensitive check here would let @Admin through.
            expect(sanitiseUsername("@Admin")).toBe("");
            expect(sanitiseUsername("@API")).toBe("");
        });

        it.each(["foo.keys", "foo.gpg", "foo.rss", "foo.atom", "foo.png"])(
            "falls back for the reserved pattern %s",
            (name) => {
                expect(sanitiseUsername(`@${name}`)).toBe("");
            },
        );

        it("falls back when nothing usable is left", () => {
            expect(sanitiseUsername("@...")).toBe("");
            expect(sanitiseUsername("@---")).toBe("");
            expect(sanitiseUsername("@")).toBe("");
            expect(sanitiseUsername("@ ")).toBe("");
        });

        it("honours the instance's extra reserved names", () => {
            expect(sanitiseUsername("@acme", ["acme"])).toBe("");
            expect(sanitiseUsername("@ACME", ["acme"])).toBe("");
            expect(sanitiseUsername("@acme", ["other"])).toBe("acme");
        });
    });

    it("accepts an ename with no leading @", () => {
        // Not the documented shape, but cheap to tolerate and expensive to get
        // wrong.
        expect(sanitiseUsername("alice")).toBe("alice");
    });
});

describe("buildClaims", () => {
    it("matches the design's example table", () => {
        expect(claimsFor("@alice")).toMatchObject({
            sub: "@alice",
            nickname: "alice",
            preferred_username: "alice",
            email: "alice@w3ds.invalid",
        });

        expect(claimsFor("@user-a.w3id")).toMatchObject({
            sub: "@user-a.w3id",
            nickname: "user-a.w3id",
            email: "user-a.w3id@w3ds.invalid",
        });

        expect(claimsFor("@_bob")).toMatchObject({
            sub: "@_bob",
            nickname: "bob",
            email: "_bob@w3ds.invalid",
        });

        expect(claimsFor("@admin")).toMatchObject({
            sub: "@admin",
            nickname: "",
            email: "admin@w3ds.invalid",
        });
    });

    it("keeps the full ename as sub", () => {
        // sub is the identity. It lands in external_login_user.external_id and
        // must never be ambiguous; the username is presentation only.
        expect(claimsFor("@Admin").sub).toBe("@Admin");
        expect(claimsFor("@...").sub).toBe("@...");
    });

    it("emits the same value in nickname and preferred_username", () => {
        // So the result is identical whichever the USERNAME setting is.
        for (const ename of ["@alice", "@admin", "@josé", "@..."]) {
            const claims = claimsFor(ename);
            expect(claims.nickname).toBe(claims.preferred_username);
        }
    });

    it("marks the synthetic address unverified", () => {
        expect(claimsFor("@alice").email_verified).toBe(false);
    });

    it("uses the configured email domain", () => {
        expect(
            buildClaims("@alice", { emailDomain: "example.test" }).email,
        ).toBe("alice@example.test");
    });

    it("derives the address from the ename, not from the username", () => {
        // Staying closer to the ename keeps the address from being the cause of a
        // false conflict between two distinct identities.
        const claims = claimsFor("@_bob");
        expect(claims.nickname).toBe("bob");
        expect(claims.email).toBe("_bob@w3ds.invalid");
    });

    describe("the address must survive Go's mail.ParseAddress", () => {
        // Forgejo parses it with mail.ParseAddress before storing it. A dot-atom
        // may not begin with, end with, or double up on dots, so the local part
        // gets stricter treatment than the username needs.
        const localPart = (ename: string) =>
            claimsFor(ename).email.split("@")[0] ?? "";

        it.each([
            "@...",
            "@alice",
            "@_bob",
            "@.alice.",
            "@a..b",
            "@josé",
            "@@@",
        ])("%s yields a well-formed local part", (ename) => {
            const local = localPart(ename);
            expect(local).not.toBe("");
            expect(local.startsWith(".")).toBe(false);
            expect(local.endsWith(".")).toBe(false);
            expect(local).not.toMatch(/\.\./);
            expect(local).not.toMatch(/@/);
        });

        it("falls back to a deterministic local part when nothing survives", () => {
            expect(localPart("@...")).toMatch(/^w3ds-[0-9a-f]{12}$/);
            expect(localPart("@...")).toBe(localPart("@..."));
            expect(localPart("@...")).not.toBe(localPart("@---"));
        });
    });

    describe("the fallback must be present and empty, never absent", () => {
        // An absent preferred_username panics Forgejo's account-linking page:
        // getUserName does RawData["preferred_username"].(string) with no guard
        // (routers/web/auth/auth.go:405). This is a regression guard, not a
        // behaviour check — an assertion on falsiness alone would pass on an
        // absent key, which is exactly the crash case.
        it.each(["@admin", "@api", "@...", "@", "@foo.keys"])(
            "for %s",
            (ename) => {
                const claims = claimsFor(ename);

                expect(Object.hasOwn(claims, "nickname")).toBe(true);
                expect(Object.hasOwn(claims, "preferred_username")).toBe(true);
                expect(claims.nickname).toBe("");
                expect(claims.preferred_username).toBe("");
            },
        );

        it("survives JSON serialisation into the ID token", () => {
            // The claims are signed as JSON. A key whose value is undefined
            // disappears at this point rather than at construction, so assert on
            // the shape that actually reaches Forgejo.
            const encoded = JSON.parse(JSON.stringify(claimsFor("@admin")));
            expect(Object.hasOwn(encoded, "nickname")).toBe(true);
            expect(Object.hasOwn(encoded, "preferred_username")).toBe(true);
        });
    });
});
