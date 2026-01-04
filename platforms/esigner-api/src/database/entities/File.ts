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
import { User } from "./User";
import { FileSignee } from "./FileSignee";
import { SignatureContainer } from "./SignatureContainer";

@Entity("files")
export class File {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column()
    mimeType!: string;

    @Column("bigint")
    size!: number;

    @Column({ type: "text" })
    md5Hash!: string;

    @Column({ type: "bytea" })
    data!: Buffer;

    @Column()
    ownerId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "ownerId" })
    owner!: User;

    @OneToMany(() => FileSignee, (fileSignee) => fileSignee.file)
    signees!: FileSignee[];

    @OneToMany(() => SignatureContainer, (signature) => signature.file)
    signatures!: SignatureContainer[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}


