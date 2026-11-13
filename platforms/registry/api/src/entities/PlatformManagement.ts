import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class PlatformManagement {
    @PrimaryColumn()
    ename!: string;

    @Column()
    manager!: string;

    @Column()
    profileEnvelopeId!: string;

    @Column({ type: "varchar", length: 64 })
    revokedTokenFingerprint!: string;

    @CreateDateColumn({ type: "timestamptz" })
    createdAt!: Date;

    @UpdateDateColumn({ type: "timestamptz" })
    updatedAt!: Date;
}
