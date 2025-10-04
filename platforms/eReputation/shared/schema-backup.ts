// Backup of original Drizzle schema for reference
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Reputation calculations table
export const reputationCalculations = pgTable("reputation_calculations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetType: varchar("target_type").notNull(), // 'self', 'user', 'group', 'platform'
  targetId: varchar("target_id"), // null for self calculations
  targetName: varchar("target_name"),
  variables: jsonb("variables").notNull(), // selected analysis variables
  score: decimal("score", { precision: 3, scale: 1 }),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  analysis: text("analysis"),
  isPublic: boolean("is_public").default(false),
  status: varchar("status").notNull().default("processing"), // 'processing', 'complete', 'error'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// References table
export const references = pgTable("references", {
  id: serial("id").primaryKey(),
  authorId: varchar("author_id").notNull().references(() => users.id),
  targetType: varchar("target_type").notNull(), // 'user', 'group', 'platform'
  targetId: varchar("target_id").notNull(),
  targetName: varchar("target_name").notNull(),
  referenceType: varchar("reference_type").notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments"), // file URLs and metadata
  status: varchar("status").notNull().default("submitted"), // 'submitted', 'verified', 'rejected'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// File uploads table
export const fileUploads = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  mimeType: varchar("mime_type").notNull(),
  size: integer("size").notNull(),
  url: varchar("url").notNull(),
  referenceId: integer("reference_id").references(() => references.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertReputationCalculationSchema = createInsertSchema(reputationCalculations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReferenceSchema = createInsertSchema(references).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFileUploadSchema = createInsertSchema(fileUploads).omit({
  id: true,
  createdAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type ReputationCalculation = typeof reputationCalculations.$inferSelect;
export type InsertReputationCalculation = z.infer<typeof insertReputationCalculationSchema>;
export type Reference = typeof references.$inferSelect;
export type InsertReference = z.infer<typeof insertReferenceSchema>;
export type FileUpload = typeof fileUploads.$inferSelect;
export type InsertFileUpload = z.infer<typeof insertFileUploadSchema>;