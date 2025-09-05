import { users, apps, reviews, type User, type InsertUser, type App, type InsertApp, type Review, type InsertReview } from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getApps(): Promise<App[]>;
  getApp(id: string): Promise<App | undefined>;
  createApp(app: InsertApp): Promise<App>;
  updateApp(id: string, app: Partial<InsertApp>): Promise<App | undefined>;
  deleteApp(id: string): Promise<boolean>;
  
  getReviews(appId: string): Promise<Review[]>;
  createReview(review: InsertReview): Promise<Review>;
  updateAppRating(appId: string): Promise<void>;
  
  sessionStore: session.SessionStore;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.SessionStore;

  constructor() {
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, isAdmin: true }) // First user is admin
      .returning();
    return user;
  }

  async getApps(): Promise<App[]> {
    return await db.select().from(apps).orderBy(desc(apps.createdAt));
  }

  async getApp(id: string): Promise<App | undefined> {
    const [app] = await db.select().from(apps).where(eq(apps.id, id));
    return app || undefined;
  }

  async createApp(insertApp: InsertApp): Promise<App> {
    const [app] = await db
      .insert(apps)
      .values({
        ...insertApp,
        updatedAt: new Date(),
      })
      .returning();
    return app;
  }

  async updateApp(id: string, updateData: Partial<InsertApp>): Promise<App | undefined> {
    const [app] = await db
      .update(apps)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(apps.id, id))
      .returning();
    return app || undefined;
  }

  async deleteApp(id: string): Promise<boolean> {
    const result = await db.delete(apps).where(eq(apps.id, id));
    return (result.rowCount || 0) > 0;
  }

  async getReviews(appId: string): Promise<Review[]> {
    return await db
      .select()
      .from(reviews)
      .where(eq(reviews.appId, appId))
      .orderBy(desc(reviews.createdAt));
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const [review] = await db
      .insert(reviews)
      .values(insertReview)
      .returning();
    
    // Update app rating
    await this.updateAppRating(insertReview.appId);
    
    return review;
  }

  async updateAppRating(appId: string): Promise<void> {
    const result = await db
      .select({
        avgRating: sql<string>`COALESCE(ROUND(AVG(${reviews.rating}::numeric), 2), 0)::text`,
        count: sql<number>`COUNT(*)`,
      })
      .from(reviews)
      .where(eq(reviews.appId, appId));

    const { avgRating, count } = result[0];
    
    await db
      .update(apps)
      .set({
        averageRating: avgRating || "0.00",
        totalReviews: count || 0,
        updatedAt: new Date(),
      })
      .where(eq(apps.id, appId));
  }
}

export const storage = new DatabaseStorage();
