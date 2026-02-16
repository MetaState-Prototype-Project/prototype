import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from "typeorm";
import { Currency } from "./Currency";

export enum AccountType {
    USER = "user",
    GROUP = "group",
}

export enum LedgerType {
    DEBIT = "debit",
    CREDIT = "credit",
}

@Entity("ledger")
@Index(["currencyId", "accountId", "accountType"])
export class Ledger {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    currencyId!: string;

    @ManyToOne(() => Currency)
    @JoinColumn({ name: "currencyId" })
    currency!: Currency;

    @Column()
    accountId!: string; // Can be User or Group ID

    @Column({
        type: "enum",
        enum: AccountType,
    })
    accountType!: AccountType;

    @Column("decimal", { precision: 18, scale: 2 })
    amount!: number; // Positive or negative

    @Column({
        type: "enum",
        enum: LedgerType,
    })
    type!: LedgerType;

    @Column({ nullable: true })
    description!: string;

    @Column({ nullable: true })
    senderAccountId!: string; // The account that sent the money

    @Column({
        type: "enum",
        enum: AccountType,
        nullable: true,
    })
    senderAccountType!: AccountType | null;

    @Column({ nullable: true })
    receiverAccountId!: string; // The account that received the money

    @Column({
        type: "enum",
        enum: AccountType,
        nullable: true,
    })
    receiverAccountType!: AccountType | null;

    @Column("decimal", { precision: 18, scale: 2 })
    balance!: number; // Running balance after this entry

    @Column({ type: "text", nullable: true })
    hash!: string | null;

    @Column({ type: "text", nullable: true })
    prevHash!: string | null;

    @CreateDateColumn()
    createdAt!: Date;
}

