import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
} from "typeorm";

@Entity("users")
export class User {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Column({ nullable: true, unique: true })
	ename!: string;

	@Column({ nullable: true })
	name!: string;

	@Column({ nullable: true })
	handle!: string;

	@Column({ nullable: true, type: "text" })
	bio!: string;

	@Column({ nullable: true })
	avatarFileId!: string;

	@Column({ nullable: true })
	bannerFileId!: string;

	@Column({ nullable: true })
	headline!: string;

	@Column({ nullable: true })
	location!: string;

	@Column("text", { array: true, nullable: true })
	skills!: string[];

	@Column({ default: false })
	isVerified!: boolean;

	@Column({ default: true })
	isPublic!: boolean;

	@Column({ default: false })
	isArchived!: boolean;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;
}
