import { Column, Entity, PrimaryColumn } from "typeorm";

/** Cross-process worker health, read by the API readiness endpoint. */
@Entity("worker_heartbeats")
export class WorkerHeartbeat {
    @PrimaryColumn({ type: "varchar" })
    workerId!: string;

    @Column({ type: "timestamptz" })
    heartbeatAt!: Date;

    @Column({ type: "timestamptz", nullable: true })
    tickStartedAt!: Date | null;

    @Column({ type: "timestamptz", nullable: true })
    lastCompletedAt!: Date | null;

    @Column({ type: "text", nullable: true })
    lastError!: string | null;

    /** Last tick that claimed and processed a batch without error. */
    @Column({ type: "timestamptz", nullable: true })
    lastSuccessAt!: Date | null;

    /** Ticks failed since `lastSuccessAt`; a fresh heartbeat alone is not health. */
    @Column({ type: "int", default: 0 })
    consecutiveFailures!: number;
}
