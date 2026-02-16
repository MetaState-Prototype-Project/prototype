import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany,
    JoinColumn,
    ManyToMany,
    JoinTable,
} from "typeorm";
import { User } from "./User";
import { File } from "./File";
import { Tag } from "./Tag";

@Entity("folders")
export class Folder {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string;

    @Column({ nullable: true })
    parentFolderId!: string | null;

    @Column()
    ownerId!: string;

    @ManyToOne(() => User)
    @JoinColumn({ name: "ownerId" })
    owner!: User;

    @ManyToOne(() => Folder, (folder) => folder.children, { nullable: true })
    @JoinColumn({ name: "parentFolderId" })
    parent!: Folder | null;

    @OneToMany(() => Folder, (folder) => folder.parent)
    children!: Folder[];

    @OneToMany(() => File, (file) => file.folder)
    files!: File[];

    @ManyToMany(() => Tag, (tag) => tag.folders)
    @JoinTable({
        name: "folder_tags",
        joinColumn: { name: "folderId", referencedColumnName: "id" },
        inverseJoinColumn: { name: "tagId", referencedColumnName: "id" }
    })
    tags!: Tag[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

