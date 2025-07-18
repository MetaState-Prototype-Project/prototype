import { pgTable, text, serial, integer, boolean, timestamp, jsonb, varchar, index } from "drizzle-orm/pg-core";
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

export const socialGroups = pgTable("social_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  platform: text("platform").notNull(), // "instagram", "facebook", "discord"
  externalId: text("external_id").notNull(),
  memberCount: integer("member_count").notNull().default(0),
  imageUrl: text("image_url"),
  ownerId: varchar("owner_id").references(() => users.id),
});

export const charters = pgTable("charters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  guidelines: jsonb("guidelines").$type<string[]>().default([]),
  groupId: integer("group_id").references(() => socialGroups.id),
  ownerId: varchar("owner_id").references(() => users.id),
  autoApprove: boolean("auto_approve").default(false),
  allowPosts: boolean("allow_posts").default(true),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").references(() => socialGroups.id),
  userId: varchar("user_id").references(() => users.id),
  role: text("role").notNull().default("member"), // "owner", "admin", "member"
  joinedAt: timestamp("joined_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSocialGroupSchema = createInsertSchema(socialGroups).omit({
  id: true,
});

export const insertCharterSchema = createInsertSchema(charters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  id: true,
  joinedAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertSocialGroup = z.infer<typeof insertSocialGroupSchema>;
export type SocialGroup = typeof socialGroups.$inferSelect;

export type InsertCharter = z.infer<typeof insertCharterSchema>;
export type Charter = typeof charters.$inferSelect;

export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;
export type GroupMember = typeof groupMembers.$inferSelect;

// Extended types for API responses
export type CharterWithGroup = Charter & {
  group: SocialGroup;
  owner: User;
};

export type GroupWithMembers = SocialGroup & {
  members: (GroupMember & { user: User })[];
  charter?: Charter;
};

export type CharterDetail = Charter & {
  group: SocialGroup;
  owner: User;
  admins: User[];
  members: User[];
  stats: {
    totalPosts: number;
    engagementRate: number;
  };
};
