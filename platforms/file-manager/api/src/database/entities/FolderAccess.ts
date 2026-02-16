import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from "typeorm";
import { Folder } from "./Folder";
import { User } from "./User";

@Entity("folder_access")
export class FolderAccess {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    folderId!: string;

    @Column()
    userId!: string;

    @Column()
    grantedBy!: string;

    @Column({ default: "view" })
    permission!: "view";

    @ManyToOne(() => Folder)
    @JoinColumn({ name: "folderId" })
    folder!: Folder;

    @ManyToOne(() => User)
    @JoinColumn({ name: "userId" })
    user!: User;

    @ManyToOne(() => User)
    @JoinColumn({ name: "grantedBy" })
    granter!: User;

    @CreateDateColumn()
    createdAt!: Date;
}

