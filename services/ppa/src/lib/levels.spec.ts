import { describe, expect, it } from "vitest";
import frameworkJson from "../../config/certification-framework.json";
import {
    computeLevel,
    type DimensionAnswer,
    type Framework,
} from "./levels";

const framework = frameworkJson as unknown as Framework;

/**
 * The cheapest answer for a dimension that still satisfies `level`. Some rows
 * (W3DS compatibility, source availability) have a single option that
 * satisfies every level because the framework requires them throughout, so
 * "the highest option at or below N" is the wrong way to model a platform
 * sitting at level N.
 */
function pick(id: string, level: number): DimensionAnswer {
    const dimension = framework.dimensions.find((d) => d.id === id);
    if (!dimension) throw new Error(`no dimension ${id}`);
    let best = Infinity;
    let option = -1;
    dimension.options.forEach((o, i) => {
        if (o.level >= level && o.level < best) {
            best = o.level;
            option = i;
        }
    });
    if (option === -1) throw new Error(`${id} cannot reach level ${level}`);
    return { id, option };
}

const allAt = (level: number) => framework.dimensions.map((d) => pick(d.id, level));

describe("computeLevel", () => {
    it("awards the level every dimension supports", () => {
        expect(computeLevel(framework, allAt(5), "IAL4").level).toBe("L5");
        expect(computeLevel(framework, allAt(3), "IAL4").level).toBe("L3");
        expect(computeLevel(framework, allAt(0), "IAL2").level).toBe("L0");
    });

    it("lets one weak dimension drag the result without pinning it", () => {
        const answers = [
            ...allAt(5).filter((a) => a.id !== "code-review"),
            pick("code-review", 1),
        ];
        const result = computeLevel(framework, answers, "IAL4");
        // Geometric mean of fifteen 5s and a single 1 — well below 5, but not
        // dragged all the way down to it the way a strict minimum would.
        expect(result.score).toBeGreaterThan(1);
        expect(result.score).toBeLessThan(5);
        expect(result.level).toBe("L4");
        expect(result.limiting).toBe("code-review");
    });

    it("punishes a weakness far harder than an arithmetic mean would", () => {
        const answers = [
            ...allAt(5).filter((a) => a.id !== "code-review"),
            pick("code-review", 1),
        ];
        const { score } = computeLevel(framework, answers, "IAL4");
        const arithmetic =
            (5 * (framework.dimensions.length - 1) + 1) / framework.dimensions.length;
        expect(score).toBeLessThan(arithmetic);
    });

    it("holds the release at L0 when any dimension meets nothing above it", () => {
        const answers = [
            ...allAt(5).filter((a) => a.id !== "functional-review"),
            pick("functional-review", 0),
        ];
        const result = computeLevel(framework, answers, "IAL4");
        expect(result.score).toBe(0);
        expect(result.level).toBe("L0");
    });

    it("caps at the identity floor even when every dimension is perfect", () => {
        // L3+ requires IAL4; IAL3 can therefore support no more than L2.
        const result = computeLevel(framework, allAt(5), "IAL3");
        expect(result.level).toBe("L2");
        expect(result.limiting).toBe("identity");
    });

    it("refuses any level for an anonymous responsible party", () => {
        expect(computeLevel(framework, allAt(5), "IAL1").level).toBeNull();
    });

    it("treats an unanswered dimension as no evidence", () => {
        const answers = allAt(5).filter((a) => a.id !== "interview");
        const result = computeLevel(framework, answers, "IAL4");
        expect(result.level).toBeNull();
        expect(result.blocked).toBe(true);
        expect(result.limiting).toBe("interview");
    });

    it("reports every dimension's satisfied level for display", () => {
        const result = computeLevel(framework, allAt(2), "IAL3");
        expect(result.perDimension).toHaveLength(framework.dimensions.length);
        expect(result.perDimension.every((d) => d.level >= 2)).toBe(true);
    });
});
