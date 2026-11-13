import type { Repository } from "typeorm";
import {
    type IpRuleMatcher,
    canonicalizeSubject,
    compileIpRules,
    isTooBroad,
} from "../core/http/ip-rules";
import {
    DEFAULT_SUBJECT,
    type RateLimitKind,
    type RateLimitMode,
    type RateLimitRule,
} from "../entities/RateLimitRule";

const POLL_MS = 30_000;
const MAX_LIMIT = 1_000_000;
const KINDS: RateLimitKind[] = ["platform", "ip"];
const MODES: RateLimitMode[] = ["limit", "blocked", "exempt"];

export type LimitSource = "db" | "env";

export interface RateLimitSnapshot {
    /** Where the rules came from: the table, or env defaults alone. */
    source: LimitSource;
    loadedAt: Date;
    platformDefault: { limit: number; source: LimitSource };
    ipDefault: { limit: number; source: LimitSource };
    /** Platform rules by exact platform name, defaults excluded. */
    platformRules: Map<string, RateLimitRule>;
    /** The most specific IP rule covering an address, defaults excluded. */
    matchIp: IpRuleMatcher<RateLimitRule>;
    /** Every usable rule, defaults included. */
    rules: RateLimitRule[];
}

export interface RuleInput {
    kind?: unknown;
    subject?: unknown;
    mode?: unknown;
    limitPerMinute?: unknown;
    note?: unknown;
    updatedBy?: unknown;
}

export class RuleValidationError extends Error {
    constructor(
        message: string,
        readonly field: string,
    ) {
        super(message);
    }
}

function envLimit(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 ? value : fallback;
}

function isUsable(rule: RateLimitRule): boolean {
    if (!KINDS.includes(rule.kind) || !MODES.includes(rule.mode)) return false;
    if (rule.mode === "limit") {
        return Number.isInteger(rule.limitPerMinute) && rule.limitPerMinute! > 0;
    }
    return rule.subject !== DEFAULT_SUBJECT;
}

function buildSnapshot(
    rows: RateLimitRule[],
    source: LimitSource,
): RateLimitSnapshot {
    const rules: RateLimitRule[] = [];
    for (const row of rows) {
        if (isUsable(row)) rules.push(row);
        else console.warn(`[rate-limit] ignoring malformed rule ${row.id}`);
    }

    const defaultFor = (kind: RateLimitKind, env: string, fallback: number) => {
        const row = rules.find(
            (r) => r.kind === kind && r.subject === DEFAULT_SUBJECT,
        );
        return row
            ? { limit: row.limitPerMinute!, source: "db" as const }
            : { limit: envLimit(env, fallback), source: "env" as const };
    };

    const specific = rules.filter((r) => r.subject !== DEFAULT_SUBJECT);
    return {
        source,
        loadedAt: new Date(),
        platformDefault: defaultFor("platform", "RATE_LIMIT_PER_PLATFORM", 250),
        ipDefault: defaultFor("ip", "RATE_LIMIT_PER_IP", 500),
        platformRules: new Map(
            specific
                .filter((r) => r.kind === "platform")
                .map((r) => [r.subject, r]),
        ),
        matchIp: compileIpRules(specific.filter((r) => r.kind === "ip")),
        rules,
    };
}

/**
 * Checks an admin-supplied rule and returns it in stored form. IP subjects
 * are canonicalised so the same range cannot be entered twice.
 */
export function validateRuleInput(input: RuleInput): {
    kind: RateLimitKind;
    subject: string;
    mode: RateLimitMode;
    limitPerMinute: number | null;
    note: string | null;
    updatedBy: string | null;
} {
    const kind = input.kind as RateLimitKind;
    if (!KINDS.includes(kind)) {
        throw new RuleValidationError("kind must be platform or ip", "kind");
    }
    const mode = input.mode as RateLimitMode;
    if (!MODES.includes(mode)) {
        throw new RuleValidationError(
            "mode must be limit, blocked or exempt",
            "mode",
        );
    }

    if (typeof input.subject !== "string" || !input.subject.trim()) {
        throw new RuleValidationError("subject is required", "subject");
    }
    let subject = input.subject.trim();
    if (subject === DEFAULT_SUBJECT) {
        if (mode !== "limit") {
            throw new RuleValidationError(
                "The default can only be a limit",
                "mode",
            );
        }
    } else if (kind === "ip") {
        try {
            subject = canonicalizeSubject(subject);
        } catch (error) {
            throw new RuleValidationError((error as Error).message, "subject");
        }
        if (mode !== "limit" && isTooBroad(subject)) {
            throw new RuleValidationError(
                "Range is too broad to block or exempt (minimum /8 for IPv4, /32 for IPv6)",
                "subject",
            );
        }
    } else if (subject.length > 256) {
        throw new RuleValidationError(
            "subject must be at most 256 characters",
            "subject",
        );
    }

    let limitPerMinute: number | null = null;
    if (mode === "limit") {
        const limit = input.limitPerMinute;
        if (
            typeof limit !== "number" ||
            !Number.isInteger(limit) ||
            limit < 1 ||
            limit > MAX_LIMIT
        ) {
            throw new RuleValidationError(
                `limitPerMinute must be a whole number from 1 to ${MAX_LIMIT}`,
                "limitPerMinute",
            );
        }
        limitPerMinute = limit;
    }

    const text = (value: unknown, field: string, max: number) => {
        if (value === undefined || value === null || value === "") return null;
        if (typeof value !== "string" || value.length > max) {
            throw new RuleValidationError(
                `${field} must be text of at most ${max} characters`,
                field,
            );
        }
        return value;
    };

    return {
        kind,
        subject,
        mode,
        limitPerMinute,
        note: text(input.note, "note", 500),
        updatedBy: text(input.updatedBy, "updatedBy", 256),
    };
}

/**
 * Holds the rate limit rules in memory so the request path never touches the
 * database. The snapshot is rebuilt after every admin write and on a poll, so
 * other instances pick a change up within {@link POLL_MS}.
 *
 * A failed load keeps the last good snapshot; with none, the env defaults
 * apply. Rate limiting never fails closed on a database outage.
 */
export class RateLimitConfigService {
    private current: RateLimitSnapshot = buildSnapshot([], "env");
    private healthy = true;
    private timer?: NodeJS.Timeout;

    constructor(
        private readonly repository: Pick<
            Repository<RateLimitRule>,
            "find" | "findOne" | "save" | "create" | "delete"
        >,
    ) {}

    get snapshot(): RateLimitSnapshot {
        return this.current;
    }

    async reload(): Promise<void> {
        try {
            const rows = await this.repository.find();
            this.current = buildSnapshot(rows, "db");
            if (!this.healthy) console.log("[rate-limit] rules reloaded");
            this.healthy = true;
        } catch (error) {
            if (this.healthy) {
                console.error(
                    `[rate-limit] could not load rules, keeping ${this.current.source === "db" ? "the last loaded rules" : "env defaults"}:`,
                    error,
                );
            }
            this.healthy = false;
        }
    }

    async start(): Promise<void> {
        await this.reload();
        this.timer = setInterval(() => void this.reload(), POLL_MS);
        this.timer.unref();
    }

    stop(): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
    }

    /** Creates the rule for a subject, or replaces the one it already has. */
    async upsert(input: RuleInput): Promise<RateLimitRule> {
        const rule = validateRuleInput(input);
        const existing = await this.repository.findOne({
            where: { kind: rule.kind, subject: rule.subject },
        });
        const saved = await this.repository.save(
            existing
                ? Object.assign(existing, rule)
                : this.repository.create(rule),
        );
        await this.reload();
        return saved;
    }

    /** Removes a rule. Returns false when there was none with that id. */
    async remove(id: string): Promise<boolean> {
        const result = await this.repository.delete({ id });
        await this.reload();
        return Boolean(result.affected);
    }
}
