import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";

@Entity("user_evault_mappings")
export class UserEVaultMapping {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    localUserId!: string;

    @Column()
    evaultW3id!: string;

    @Column()
    evaultUri!: string;

    @Column({ nullable: true })
    userProfileId!: string; // ID of the UserProfile object in the eVault

    @Column({ type: "jsonb", nullable: true })
    userProfileData!: any; // Store the UserProfile data

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
} 