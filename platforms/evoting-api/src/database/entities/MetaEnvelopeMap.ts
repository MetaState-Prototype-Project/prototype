import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("meta_envelope_maps")
export class MetaEnvelopeMap {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column("varchar", { length: 255 })
    localId!: string;

    @Column("varchar", { length: 255 })
    globalId!: string;

    @Column("varchar", { length: 255 })
    entityType!: string;

    @Column("varchar", { length: 255 })
    platform!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 