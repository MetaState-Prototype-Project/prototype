import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
} from "typeorm";

@Entity("device_token")
@Index(["eName", "deviceId"], { unique: true })
export class DeviceToken {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column({ type: "varchar" })
    eName!: string;

    @Column({ type: "varchar" })
    token!: string;

    @Column({ type: "varchar" })
    platform!: string;

    @Column({ type: "varchar" })
    deviceId!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
