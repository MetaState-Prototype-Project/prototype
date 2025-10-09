import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("notifications")
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    eName!: string;

    @Column()
    title!: string;

    @Column()
    body!: string;

    @Column({ type: "jsonb", nullable: true })
    data?: Record<string, any>;

    @Column({ default: false })
    delivered!: boolean;

    @Column({ nullable: true })
    deliveredAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}
