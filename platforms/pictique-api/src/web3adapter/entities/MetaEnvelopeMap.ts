import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm";

@Entity("_w3_adapter_meta_envelope_maps")
export class MetaEnvelopeMap {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    @Index()
    metaEnvelopeId!: string;

    @Column()
    @Index()
    internalId!: string;

    @Column()
    entityType!: string;

    @Column({ nullable: true })
    parentMetaEnvelopeId?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 