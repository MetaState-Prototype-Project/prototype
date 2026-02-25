import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from "typeorm";
import { Poll } from "./Poll";
import { User } from "./User";

export type DelegationStatus = "pending" | "active" | "rejected" | "revoked" | "used";

@Entity("delegations")
export class Delegation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @ManyToOne(() => Poll, { onDelete: "CASCADE" })
    @JoinColumn({ name: "pollId" })
    poll!: Poll;

    @Column("uuid")
    pollId!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "delegatorId" })
    delegator!: User;

    @Column("uuid")
    delegatorId!: string;

    @ManyToOne(() => User, { onDelete: "CASCADE" })
    @JoinColumn({ name: "delegateId" })
    delegate!: User;

    @Column("uuid")
    delegateId!: string;

    @Column("enum", {
        enum: ["pending", "active", "rejected", "revoked", "used"],
        default: "pending",
    })
    status!: DelegationStatus;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
