import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToOne,
} from "typeorm";
import { File } from "./File";
import { User } from "./User";
import { SignatureContainer } from "./SignatureContainer";

@Entity("file_signees")
export class FileSignee {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    fileId!: string;

    @Column()
    userId!: string;

    @Column()
    invitedBy!: string;

    @Column({
        type: "varchar",
        default: "pending"
    })
    status!: "pending" | "signed" | "declined";

    @CreateDateColumn()
    invitedAt!: Date;

    @Column({ nullable: true })
    signedAt!: Date;

    @Column({ nullable: true })
    declinedAt!: Date;

    @ManyToOne(() => File)
    @JoinColumn({ name: "fileId" })
    file!: File;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "invitedBy" })
    inviter!: User;

    @OneToOne(() => SignatureContainer, (signature) => signature.fileSignee, { nullable: true })
    signature!: SignatureContainer | null;
}

