import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("meta_envelope_map")
export class MetaEnvelopeMap {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    localId!: string;

    @Column()
    globalId!: string;

    @Column()
    entityType!: string;

    @Column()
    platform!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 