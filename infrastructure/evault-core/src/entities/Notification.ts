import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity("notifications")
export class Notification {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar" })
    eName!: string;

    @Column({ type: "varchar" })
    title!: string;

    @Column({ type: "text" })
    body!: string;

    @Column({ type: "jsonb", nullable: true })
    data?: Record<string, any>;

    @Column({ type: "boolean", default: false })
    delivered!: boolean;

    @Column({ type: "timestamp", nullable: true })
    deliveredAt!: Date;

    @CreateDateColumn()
    createdAt!: Date;
}
