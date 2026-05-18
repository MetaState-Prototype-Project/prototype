import { describe, expect, it } from "vitest";
import {
	buildFileUri,
	InvalidW3dsUriError,
	isFileUri,
	parseFileUri,
} from "./uri";

describe("w3ds file URI", () => {
	describe("buildFileUri", () => {
		it("builds a canonical URI", () => {
			expect(buildFileUri({ ename: "@alice", metaEnvelopeId: "abc123" })).toBe(
				"w3ds://file?id=@alice/abc123",
			);
		});

		it("normalises a missing @ prefix on the ename", () => {
			expect(buildFileUri({ ename: "alice", metaEnvelopeId: "abc123" })).toBe(
				"w3ds://file?id=@alice/abc123",
			);
		});

		it("throws when ename or metaEnvelopeId is missing", () => {
			expect(() => buildFileUri({ ename: "", metaEnvelopeId: "abc" })).toThrow(
				InvalidW3dsUriError,
			);
			expect(() =>
				buildFileUri({ ename: "@alice", metaEnvelopeId: "" }),
			).toThrow(InvalidW3dsUriError);
		});
	});

	describe("parseFileUri", () => {
		it("round-trips with buildFileUri", () => {
			const uri = buildFileUri({
				ename: "@alice",
				metaEnvelopeId: "envelope-abc123",
			});
			expect(parseFileUri(uri)).toEqual({
				ename: "@alice",
				metaEnvelopeId: "envelope-abc123",
			});
		});

		it("rejects an empty input", () => {
			expect(() => parseFileUri("")).toThrow(InvalidW3dsUriError);
		});

		it("rejects a non-w3ds scheme", () => {
			expect(() => parseFileUri("https://file?id=@alice/abc")).toThrow(
				/expected scheme/,
			);
		});

		it("rejects a wrong host", () => {
			expect(() => parseFileUri("w3ds://blob?id=@alice/abc")).toThrow(
				/expected host/,
			);
		});

		it("rejects a missing id parameter", () => {
			expect(() => parseFileUri("w3ds://file")).toThrow(
				/missing required `id`/,
			);
		});

		it("rejects an id without an ename", () => {
			expect(() => parseFileUri("w3ds://file?id=alice/abc")).toThrow(
				/must be in the form/,
			);
		});

		it("rejects an id without a meta-envelope-id segment", () => {
			expect(() => parseFileUri("w3ds://file?id=@alice")).toThrow(
				/missing the `\/<meta-envelope-id>`/,
			);
		});

		it("rejects an empty meta-envelope-id", () => {
			expect(() => parseFileUri("w3ds://file?id=@alice/")).toThrow(
				/meta-envelope-id is empty/,
			);
		});
	});

	describe("isFileUri", () => {
		it("recognises a w3ds file URI", () => {
			expect(isFileUri("w3ds://file?id=@alice/abc")).toBe(true);
		});

		it("rejects non-file values", () => {
			expect(isFileUri("https://example.com/x.png")).toBe(false);
			expect(isFileUri(42)).toBe(false);
			expect(isFileUri(null)).toBe(false);
		});
	});
});
