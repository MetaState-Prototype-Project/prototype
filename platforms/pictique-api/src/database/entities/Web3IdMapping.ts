import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index
} from "typeorm";

@Entity("__web3_id_mapping")
export class Web3IdMapping {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    @Index()
    localId!: string;

    @Column()
    @Index()
    metaEnvelopeId!: string;

    @Column()
    @Index()
    entityType!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 