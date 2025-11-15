import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
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
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // For new email/password auth
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Extended user profile information
export const profiles = pgTable("profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  bio: text("bio"),
  location: varchar("location"),
  latitude: decimal("latitude"),
  longitude: decimal("longitude"),
  searchRadius: integer("search_radius").default(25),
  jobTitle: varchar("job_title"),
  company: varchar("company"),
  isActive: boolean("is_active").default(true),
  completionPercentage: integer("completion_percentage").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User skills (simplified - combined with interests)
export const skills = pgTable("skills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  proficiency: varchar("proficiency").notNull(), // beginner, intermediate, advanced, expert
  createdAt: timestamp("created_at").defaultNow(),
});

// User interests (replaces hobbies and habits - simplified)
export const interests = pgTable("interests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  frequency: varchar("frequency").notNull(), // daily, weekly, monthly, occasionally
  createdAt: timestamp("created_at").defaultNow(),
});

// User wishlist items (renamed to wishes for simplicity)
export const wishes = pgTable("wishes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  description: text("description"),
  priority: varchar("priority").notNull(), // urgent, high, medium, low
  status: varchar("status").default("active"), // active, completed, paused
  createdAt: timestamp("created_at").defaultNow(),
});

// Associations between wishes and helpful users
export const wishUserSuggestions = pgTable("wish_user_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wishId: varchar("wish_id").notNull().references(() => wishes.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  relevanceScore: integer("relevance_score").notNull(), // 1-100
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Associations between wishes and relevant groups
export const wishGroupSuggestions = pgTable("wish_group_suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wishId: varchar("wish_id").notNull().references(() => wishes.id),
  groupId: varchar("group_id").notNull().references(() => groups.id),
  relevanceScore: integer("relevance_score").notNull(), // 1-100
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Matches between users
export const matches = pgTable("matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId1: varchar("user_id_1").notNull().references(() => users.id),
  userId2: varchar("user_id_2").notNull().references(() => users.id),
  compatibilityScore: integer("compatibility_score").notNull(),
  matchReason: text("match_reason"),
  status: varchar("status").default("pending"), // pending, connected, rejected
  createdAt: timestamp("created_at").defaultNow(),
});

// Groups
export const groups = pgTable("groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  location: varchar("location"),
  latitude: decimal("latitude"),
  longitude: decimal("longitude"),
  memberCount: integer("member_count").default(0),
  maxMembers: integer("max_members"),
  isPublic: boolean("is_public").default(true),
  nextMeetup: timestamp("next_meetup"),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Group memberships
export const groupMemberships = pgTable("group_memberships", {
  groupId: varchar("group_id").notNull().references(() => groups.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role").default("member"), // member, admin, owner
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.groupId, table.userId] }),
}));

// AI suggestions (combines user matches and group suggestions)
export const suggestions = pgTable("suggestions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  targetType: varchar("target_type").notNull(), // "user" or "group"
  targetId: varchar("target_id").notNull(), // references users.id or groups.id
  reason: text("reason"),
  score: integer("score").notNull(),
  status: varchar("status").default("pending"), // pending, connected, joined, dismissed
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  skills: many(skills),
  interests: many(interests),
  wishes: many(wishes),
  matchesAsUser1: many(matches, { relationName: "user1Matches" }),
  matchesAsUser2: many(matches, { relationName: "user2Matches" }),
  groupMemberships: many(groupMemberships),
  createdGroups: many(groups),
  suggestions: many(suggestions),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const skillsRelations = relations(skills, ({ one }) => ({
  user: one(users, {
    fields: [skills.userId],
    references: [users.id],
  }),
}));

export const interestsRelations = relations(interests, ({ one }) => ({
  user: one(users, {
    fields: [interests.userId],
    references: [users.id],
  }),
}));

export const wishesRelations = relations(wishes, ({ one }) => ({
  user: one(users, {
    fields: [wishes.userId],
    references: [users.id],
  }),
}));

export const matchesRelations = relations(matches, ({ one }) => ({
  user1: one(users, {
    fields: [matches.userId1],
    references: [users.id],
    relationName: "user1Matches",
  }),
  user2: one(users, {
    fields: [matches.userId2],
    references: [users.id],
    relationName: "user2Matches",
  }),
}));

export const groupsRelations = relations(groups, ({ one, many }) => ({
  creator: one(users, {
    fields: [groups.createdBy],
    references: [users.id],
  }),
  memberships: many(groupMemberships),
  suggestions: many(suggestions),
}));

export const groupMembershipsRelations = relations(groupMemberships, ({ one }) => ({
  group: one(groups, {
    fields: [groupMemberships.groupId],
    references: [groups.id],
  }),
  user: one(users, {
    fields: [groupMemberships.userId],
    references: [users.id],
  }),
}));

export const suggestionsRelations = relations(suggestions, ({ one }) => ({
  user: one(users, {
    fields: [suggestions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSkillSchema = createInsertSchema(skills).omit({
  id: true,
  createdAt: true,
});

export const insertInterestSchema = createInsertSchema(interests).omit({
  id: true,
  createdAt: true,
});

export const insertWishSchema = createInsertSchema(wishes).omit({
  id: true,
  createdAt: true,
});

export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  memberCount: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Additional types for wishlist functionality
export type Wish = typeof wishes.$inferSelect;
export type InsertWish = z.infer<typeof insertWishSchema>;
export type WishUserSuggestion = typeof wishUserSuggestions.$inferSelect;
export type WishGroupSuggestion = typeof wishGroupSuggestions.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Skill = typeof skills.$inferSelect;
export type InsertSkill = z.infer<typeof insertSkillSchema>;
export type Interest = typeof interests.$inferSelect;
export type InsertInterest = z.infer<typeof insertInterestSchema>;
export type Match = typeof matches.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type GroupMembership = typeof groupMemberships.$inferSelect;
export type Suggestion = typeof suggestions.$inferSelect;

// Legacy aliases for backward compatibility
export type WishlistItem = Wish;
export type InsertWishlistItem = InsertWish;
export type GroupSuggestion = Suggestion;

// Extended types for API responses
export type UserWithProfile = User & {
  profile?: Profile;
  skills?: Skill[];
  interests?: Interest[];
  hobbies?: Interest[]; // Alias for interests for backward compatibility
  habits?: Interest[]; // Alias for interests for backward compatibility
  wishlistItems?: Wish[];
};

export type MatchWithUsers = Match & {
  user1: UserWithProfile;
  user2: UserWithProfile;
};

export type GroupWithMembers = Group & {
  memberships?: (GroupMembership & { user: User })[];
  memberCount: number;
};
