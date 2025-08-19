import {
    Entity,
    CreateDateColumn,
    UpdateDateColumn,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Group } from "./Group";
import { User } from "./User";

@Entity()
export class CharterSignature {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    groupId!: string;

    @Column()
    userId!: string;

    @Column({ type: "text" })
    charterHash!: string; // Hash of the charter content to track versions

    @Column({ type: "text" })
    signature!: string; // Cryptographic signature

    @Column({ type: "text" })
    publicKey!: string; // User's public key

    @Column({ type: "text" })
    message!: string; // Original message that was signed

    @ManyToOne(() => Group)
    @JoinColumn({ name: "groupId" })
    group!: Group;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

