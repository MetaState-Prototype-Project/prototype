import type { Repository } from "typeorm";
import type {
    BindingDocumentSecurityQuestionData,
} from "../core/types/binding-document";
import { verifyAnswer } from "../core/utils/security-answer";
import type { SecurityAnswerAttempt } from "../entities/SecurityAnswerAttempt";
import type { BindingDocumentService } from "./BindingDocumentService";

const DEFAULT_MAX_FAILED_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export interface ValidateSecurityAnswerResult {
    success: boolean;
    reason?: "locked" | "mismatch" | "not_found" | "invalid_doc";
    lockedUntil?: Date | null;
    attemptsRemaining?: number;
}

export class SecurityQuestionService {
    private readonly maxFailedAttempts: number;
    private readonly lockoutDurationMs: number;

    constructor(
        private readonly attemptRepository: Repository<SecurityAnswerAttempt>,
        private readonly bindingDocumentService: BindingDocumentService,
        opts: {
            maxFailedAttempts?: number;
            lockoutDurationMs?: number;
        } = {},
    ) {
        this.maxFailedAttempts =
            opts.maxFailedAttempts ??
            (Number.parseInt(
                process.env.SECURITY_QUESTION_MAX_ATTEMPTS ?? "",
                10,
            ) ||
                DEFAULT_MAX_FAILED_ATTEMPTS);
        this.lockoutDurationMs =
            opts.lockoutDurationMs ??
            (Number.parseInt(
                process.env.SECURITY_QUESTION_LOCKOUT_MS ?? "",
                10,
            ) ||
                DEFAULT_LOCKOUT_DURATION_MS);
    }

    async validate(
        eName: string,
        metaEnvelopeId: string,
        candidate: string,
    ): Promise<ValidateSecurityAnswerResult> {
        const attempt = await this.loadOrCreateAttempt(eName);

        const now = new Date();
        if (attempt.lockedUntil && attempt.lockedUntil > now) {
            return {
                success: false,
                reason: "locked",
                lockedUntil: attempt.lockedUntil,
            };
        }

        const doc = await this.bindingDocumentService.getBindingDocument(
            metaEnvelopeId,
            eName,
        );
        if (!doc) {
            return { success: false, reason: "not_found" };
        }
        if (doc.type !== "security_question") {
            return { success: false, reason: "invalid_doc" };
        }
        const data = doc.data as BindingDocumentSecurityQuestionData;

        const matched = await verifyAnswer(data.answerHash, candidate);

        if (matched) {
            await this.recordSuccess(attempt);
            return { success: true };
        }

        const newCount = attempt.failedCount + 1;
        attempt.failedCount = newCount;
        attempt.lastAttemptAt = now;
        let lockedUntil: Date | null = null;
        if (newCount >= this.maxFailedAttempts) {
            lockedUntil = new Date(now.getTime() + this.lockoutDurationMs);
            attempt.lockedUntil = lockedUntil;
        }
        await this.attemptRepository.save(attempt);

        return {
            success: false,
            reason: lockedUntil ? "locked" : "mismatch",
            lockedUntil,
            attemptsRemaining: Math.max(0, this.maxFailedAttempts - newCount),
        };
    }

    private async loadOrCreateAttempt(
        eName: string,
    ): Promise<SecurityAnswerAttempt> {
        const existing = await this.attemptRepository.findOne({
            where: { eName },
        });
        if (existing) return existing;
        return this.attemptRepository.create({
            eName,
            failedCount: 0,
            lockedUntil: null,
            lastAttemptAt: null,
        });
    }

    private async recordSuccess(attempt: SecurityAnswerAttempt): Promise<void> {
        attempt.failedCount = 0;
        attempt.lockedUntil = null;
        attempt.lastAttemptAt = new Date();
        await this.attemptRepository.save(attempt);
    }
}
