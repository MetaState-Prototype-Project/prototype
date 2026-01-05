import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    ManyToMany,
} from "typeorm";
import { User } from "./User";
import { File } from "./File";
import { Folder } from "./Folder";

@Entity("tags")
export class Tag {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ type: "varchar", nullable: true })
    color!: string | null;

    @Column()
    ownerId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "ownerId" })
    owner!: User;

    @ManyToMany(() => File, (file) => file.tags)
    files!: File[];

    @ManyToMany(() => Folder, (folder) => folder.tags)
    folders!: Folder[];

    @CreateDateColumn()
    createdAt!: Date;
}

