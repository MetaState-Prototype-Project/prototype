import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
    ManyToMany,
    JoinTable,
} from "typeorm";
import { User } from "./User";
import { Folder } from "./Folder";
import { SignatureContainer } from "./SignatureContainer";
import { Tag } from "./Tag";

@Entity("files")
export class File {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    name!: string; // Original file name

    @Column({ type: "varchar", nullable: true })
    displayName!: string | null; // Custom name

    @Column({ type: "text", nullable: true })
    description!: string | null; // Optional description

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

    @Column({ nullable: true })
    folderId!: string | null;

    @ManyToOne(() => User)
    @JoinColumn({ name: "ownerId" })
    owner!: User;

    @ManyToOne(() => Folder, (folder) => folder.files, { nullable: true })
    @JoinColumn({ name: "folderId" })
    folder!: Folder | null;

    @OneToMany(() => SignatureContainer, (signature) => signature.file)
    signatures!: SignatureContainer[];

    @ManyToMany(() => Tag, (tag) => tag.files)
    @JoinTable({
        name: "file_tags",
        joinColumn: { name: "fileId", referencedColumnName: "id" },
        inverseJoinColumn: { name: "tagId", referencedColumnName: "id" }
    })
    tags!: Tag[];

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}

