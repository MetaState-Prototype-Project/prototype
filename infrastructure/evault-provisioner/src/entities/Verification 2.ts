import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity()
export class Verification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ nullable: true })
    veriffId!: string;

    @Column({ nullable: true })
    approved!: boolean;

    @Column({ type: "jsonb", nullable: true })
    data!: Record<string, unknown>;

    @Column({ nullable: true })
    referenceId!: string;

    @Column({ nullable: true })
    documentId!: string;

    @Column({ default: false })
    consumed!: boolean;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
