import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToOne,
    JoinColumn,
} from "typeorm";
import { File } from "./File";
import { User } from "./User";
import { FileSignee } from "./FileSignee";

@Entity("signature_containers")
export class SignatureContainer {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    fileId!: string;

    @Column()
    userId!: string;

    @Column({ nullable: true })
    fileSigneeId!: string;

    @Column({ type: "text" })
    md5Hash!: string;

    @Column({ type: "text" })
    signature!: string;

    @Column({ type: "text" })
    publicKey!: string;

    @Column({ type: "text" })
    message!: string;

    @ManyToOne(() => File)
    @JoinColumn({ name: "fileId" })
    file!: File;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @OneToOne(() => FileSignee, (fileSignee) => fileSignee.signature, { nullable: true })
    @JoinColumn({ name: "fileSigneeId" })
    fileSignee!: FileSignee | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}


