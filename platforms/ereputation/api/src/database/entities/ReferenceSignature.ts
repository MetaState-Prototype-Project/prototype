import {
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Reference } from "./Reference";
import { User } from "./User";

@Entity("reference_signatures")
export class ReferenceSignature {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    referenceId!: string;

    @Column()
    userId!: string;

    @Column({ type: "text" })
    referenceHash!: string; // Hash of the reference content to track versions

    @Column({ type: "text" })
    signature!: string; // Cryptographic signature

    @Column({ type: "text" })
    publicKey!: string; // User's public key

    @Column({ type: "text" })
    message!: string; // Original message that was signed

    @ManyToOne(() => Reference)
    @JoinColumn({ name: "referenceId" })
    reference!: Reference;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

