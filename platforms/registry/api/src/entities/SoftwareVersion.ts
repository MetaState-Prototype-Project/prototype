import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity()
@Index(["platformEname", "version"], { unique: true })
export class SoftwareVersion {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    ename!: string;

    @Column()
    platformEname!: string;

    @Column()
    version!: string;

    @Column()
    releaseTag!: string;

    @Column()
    commitSha!: string;

    @CreateDateColumn()
    createdAt!: Date;
}
