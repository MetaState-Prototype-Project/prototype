import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from "typeorm";
import { Group } from "./Group";
import { User } from "./User";
import { Ledger } from "./Ledger";

@Entity("currencies")
export class Currency {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    description!: string;

    @Column({ unique: true })
    ename!: string; // UUID prefixed with @

    @Column()
    groupId!: string;

    @ManyToOne(() => Group)
    @JoinColumn({ name: "groupId" })
    group!: Group;

    @Column({ default: false })
    allowNegative!: boolean;

    @Column()
    createdBy!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "createdBy" })
    creator!: User;

    @OneToMany(() => Ledger, (ledger) => ledger.currency)
    ledgerEntries!: Ledger[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

