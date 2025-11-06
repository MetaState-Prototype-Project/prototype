import "reflect-metadata";
import {
  Entity,
  PrimaryColumn,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";

// Session entity for Replit Auth - mandatory
@Entity("sessions")
@Index("IDX_session_expire", ["expire"])
export class Session {
  @PrimaryColumn({ type: "varchar" })
  sid!: string;

  @Column({ type: "jsonb" })
  sess!: any;

  @Column({ type: "timestamp" })
  expire!: Date;
}

// User entity for Email/Password Auth
@Entity("users")
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar", nullable: true })
  password?: string;

  @Column({ type: "varchar", name: "first_name", nullable: true })
  firstName?: string;

  @Column({ type: "varchar", name: "last_name", nullable: true })
  lastName?: string;

  @Column({ type: "varchar", name: "profile_image_url", nullable: true })
  profileImageUrl?: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

// Reputation calculations entity
@Entity("reputation_calculations")
export class ReputationCalculation {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "user_id" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar", name: "target_type" })
  targetType!: string; // 'self', 'user', 'group', 'platform'

  @Column({ type: "varchar", name: "target_id", nullable: true })
  targetId?: string;

  @Column({ type: "varchar", name: "target_name", nullable: true })
  targetName?: string;

  @Column({ type: "jsonb" })
  variables!: any; // selected analysis variables

  @Column({ type: "decimal", precision: 3, scale: 1, nullable: true })
  score?: string;

  @Column({ type: "decimal", precision: 3, scale: 2, nullable: true })
  confidence?: string;

  @Column({ type: "text", nullable: true })
  analysis?: string;

  @Column({ type: "boolean", name: "is_public", default: false })
  isPublic!: boolean;

  @Column({ type: "varchar", default: "processing" })
  status!: string; // 'processing', 'complete', 'error'

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

// References entity
@Entity("references")
export class Reference {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "author_id" })
  authorId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "author_id" })
  author!: User;

  @Column({ type: "varchar", name: "target_type" })
  targetType!: string; // 'user', 'group', 'platform'

  @Column({ type: "varchar", name: "target_id" })
  targetId!: string;

  @Column({ type: "varchar", name: "target_name" })
  targetName!: string;

  @Column({ type: "varchar", name: "reference_type" })
  referenceType!: string;

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", nullable: true })
  attachments?: any; // file URLs and metadata

  @Column({ type: "varchar", default: "submitted" })
  status!: string; // 'submitted', 'verified', 'rejected'

  @Column({ type: "text", name: "digital_signature", nullable: true })
  digitalSignature?: string;

  @Column({ type: "timestamp", name: "signed_at", nullable: true })
  signedAt?: Date;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}

// File uploads entity
@Entity("file_uploads")
export class FileUpload {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "integer", name: "user_id" })
  userId!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column({ type: "varchar" })
  filename!: string;

  @Column({ type: "varchar", name: "original_name" })
  originalName!: string;

  @Column({ type: "varchar", name: "mime_type" })
  mimeType!: string;

  @Column({ type: "integer" })
  size!: number;

  @Column({ type: "varchar" })
  url!: string;

  @Column({ type: "integer", name: "reference_id", nullable: true })
  referenceId?: number;

  @ManyToOne(() => Reference, { nullable: true })
  @JoinColumn({ name: "reference_id" })
  reference?: Reference;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}

// Export all the insert and update types for backward compatibility
export type UpsertUser = Partial<User>;
export type InsertUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;
export type LoginUser = Pick<User, 'email' | 'password'>;
export type InsertReputationCalculation = Omit<ReputationCalculation, 'id' | 'createdAt' | 'updatedAt' | 'user'>;
export type InsertReference = Omit<Reference, 'id' | 'createdAt' | 'updatedAt' | 'author'>;
export type InsertFileUpload = Omit<FileUpload, 'id' | 'createdAt' | 'user' | 'reference'>;