import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	Index,
} from "typeorm";

@Entity("sessions")
export class Session {
	@PrimaryGeneratedColumn("uuid")
	id!: string;

	@Index()
	@Column()
	userId!: string;

	@Column()
	ename!: string;

	@Column({ unique: true })
	token!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@Column({ type: "timestamp" })
	expiresAt!: Date;
}
