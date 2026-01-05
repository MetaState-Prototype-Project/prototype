import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { File } from "./File";
import { User } from "./User";

@Entity("file_access")
export class FileAccess {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    fileId!: string;

    @Column()
    userId!: string;

    @Column()
    grantedBy!: string;

    @Column({ default: "view" })
    permission!: "view";

    @ManyToOne(() => File)
    @JoinColumn({ name: "fileId" })
    file!: File;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "grantedBy" })
    granter!: User;

    @CreateDateColumn()
    createdAt!: Date;
}

