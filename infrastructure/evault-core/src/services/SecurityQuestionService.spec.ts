import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import type {
    BindingDocument,
    BindingDocumentSecurityQuestionData,
} from "../core/types/binding-document";
import { hashAnswer } from "../core/utils/security-answer";
import type { SecurityAnswerAttempt } from "../entities/SecurityAnswerAttempt";
import { SecurityQuestionService } from "./SecurityQuestionService";

function makeAttemptRepoStub() {
    const rows = new Map<string, SecurityAnswerAttempt>();
    return {
        async findOne({ where }: { where: { eName: string } }) {
            return rows.get(where.eName) ?? null;
        },
        create(partial: Partial<SecurityAnswerAttempt>): SecurityAnswerAttempt {
            return {
                id: "",
                eName: "",
                failedCount: 0,
                lockedUntil: null,
                lastAttemptAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                ...partial,
            };
        },
        async save(row: SecurityAnswerAttempt) {
            rows.set(row.eName, row);
            return row;
        },
        __rows: rows,
    } as any;
}

function makeBindingDocServiceStub(
    answerHash: string,
    overrides?: Partial<BindingDocument>,
) {
    const doc: BindingDocument = {
        subject: "@test-user",
        type: "security_question",
        data: {
            kind: "security_question",
            question: "First pet's name?",
            answerHash,
        } satisfies BindingDocumentSecurityQuestionData,
        signatures: [],
        ...overrides,
    };
    return {
        async getBindingDocument() {
            return doc;
        },
    } as any;
}

describe("SecurityQuestionService", () => {
    const eName = "@test-user";
    const metaEnvelopeId = "doc-1";
    let answerHash: string;

    beforeEach(async () => {
        answerHash = await hashAnswer("Fluffy");
    });

    it("returns success on a correct answer and clears any prior failures", async () => {
        const repo = makeAttemptRepoStub();
        // Seed prior failures so we can confirm they get wiped.
        await repo.save({
            id: "x",
            eName,
            failedCount: 2,
            lockedUntil: null,
            lastAttemptAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const service = new SecurityQuestionService(
            repo,
            makeBindingDocServiceStub(answerHash),
        );

        const result = await service.validate(eName, metaEnvelopeId, "fluffy");
        expect(result.success).toBe(true);
        const stored = repo.__rows.get(eName);
        expect(stored.failedCount).toBe(0);
        expect(stored.lockedUntil).toBeNull();
    }, 10_000);

    it("returns mismatch + decrements remaining attempts on wrong answer", async () => {
        const repo = makeAttemptRepoStub();
        const service = new SecurityQuestionService(
            repo,
            makeBindingDocServiceStub(answerHash),
            { maxFailedAttempts: 3, lockoutDurationMs: 60_000 },
        );

        const r1 = await service.validate(eName, metaEnvelopeId, "wrong");
        expect(r1.success).toBe(false);
        expect(r1.reason).toBe("mismatch");
        expect(r1.attemptsRemaining).toBe(2);

        const r2 = await service.validate(eName, metaEnvelopeId, "wrong");
        expect(r2.attemptsRemaining).toBe(1);
        expect(r2.reason).toBe("mismatch");
    }, 15_000);

    it("locks after reaching the threshold and short-circuits while locked", async () => {
        const repo = makeAttemptRepoStub();
        const service = new SecurityQuestionService(
            repo,
            makeBindingDocServiceStub(answerHash),
            { maxFailedAttempts: 2, lockoutDurationMs: 60_000 },
        );

        await service.validate(eName, metaEnvelopeId, "nope");
        const lockResult = await service.validate(
            eName,
            metaEnvelopeId,
            "nope",
        );
        expect(lockResult.reason).toBe("locked");
        expect(lockResult.lockedUntil).toBeInstanceOf(Date);

        // Subsequent call — even with the *correct* answer — is refused
        // until the lockout expires.
        const refused = await service.validate(eName, metaEnvelopeId, "fluffy");
        expect(refused.success).toBe(false);
        expect(refused.reason).toBe("locked");
    }, 15_000);

    it("normalisation tolerates whitespace/casing on the candidate", async () => {
        const repo = makeAttemptRepoStub();
        const service = new SecurityQuestionService(
            repo,
            makeBindingDocServiceStub(answerHash),
        );
        const result = await service.validate(
            eName,
            metaEnvelopeId,
            "  FLUFFY!!  ",
        );
        expect(result.success).toBe(true);
    }, 10_000);

    it("returns not_found when the binding doc is missing", async () => {
        const repo = makeAttemptRepoStub();
        const stub = {
            async getBindingDocument() {
                return null;
            },
        } as any;
        const service = new SecurityQuestionService(repo, stub);
        const result = await service.validate(eName, "missing-id", "anything");
        expect(result.success).toBe(false);
        expect(result.reason).toBe("not_found");
    });

    it("returns invalid_doc when the binding doc is the wrong type", async () => {
        const repo = makeAttemptRepoStub();
        const stub = makeBindingDocServiceStub(answerHash, {
            type: "self",
            data: { kind: "self", name: "Test" },
        });
        const service = new SecurityQuestionService(repo, stub);
        const result = await service.validate(eName, metaEnvelopeId, "fluffy");
        expect(result.success).toBe(false);
        expect(result.reason).toBe("invalid_doc");
    });
});
