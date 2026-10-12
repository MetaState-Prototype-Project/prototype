import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    Unique,
    UpdateDateColumn,
} from "typeorm";

export type RateLimitKind = "platform" | "ip";
export type RateLimitMode = "limit" | "blocked" | "exempt";

/** The subject of the rule that sets a kind's default limit. */
export const DEFAULT_SUBJECT = "*";

/**
 * One admin-set rate limit rule. `subject` is a platform name, a canonical
 * CIDR, or `*` for the default applied to every other subject of that kind.
 */
@Entity("evault_rate_limit_rule")
@Unique("UQ_evault_rate_limit_rule_subject", ["kind", "subject"])
@Check("CHK_evault_rate_limit_rule_kind", `"kind" IN ('platform', 'ip')`)
@Check(
    "CHK_evault_rate_limit_rule_mode",
    `"mode" IN ('limit', 'blocked', 'exempt')`,
)
@Check(
    "CHK_evault_rate_limit_rule_limit",
    `("mode" = 'limit') = ("limitPerMinute" IS NOT NULL)`,
)
@Check(
    "CHK_evault_rate_limit_rule_default",
    `"subject" <> '*' OR "mode" = 'limit'`,
)
export class RateLimitRule {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar" })
    kind!: RateLimitKind;

    @Column({ type: "varchar", length: 256 })
    subject!: string;

    @Column({ type: "varchar" })
    mode!: RateLimitMode;

    @Column({ type: "integer", nullable: true })
    limitPerMinute!: number | null;

    @Column({ type: "varchar", length: 500, nullable: true })
    note!: string | null;

    @Column({ type: "varchar", nullable: true })
    updatedBy!: string | null;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;
}
