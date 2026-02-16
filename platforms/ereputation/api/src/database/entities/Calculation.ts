import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { User } from "./User";

@Entity("calculations")
export class Calculation {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    targetType!: string; // "user", "group", "platform"

    @Column()
    targetId!: string;

    @Column()
    targetName!: string;

    @Column("text")
    userValues!: string; // What the user values

    @Column("float")
    calculatedScore!: number; // Final calculated score (1-5)

    @Column("text", { nullable: true })
    calculationDetails!: string; // JSON string with calculation breakdown

    @Column()
    calculatorId!: string; // Who calculated this

    @ManyToOne(() => User)
    @JoinColumn({ name: "calculatorId" })
    calculator!: User;

    @Column()
    status!: string; // "complete", "processing", "error"

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
