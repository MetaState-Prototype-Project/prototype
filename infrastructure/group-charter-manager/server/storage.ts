import { 
  users, 
  socialGroups, 
  charters, 
  groupMembers,
  type User, 
  type InsertUser,
  type UpsertUser,
  type SocialGroup,
  type InsertSocialGroup,
  type Charter,
  type InsertCharter,
  type GroupMember,
  type InsertGroupMember,
  type CharterWithGroup,
  type GroupWithMembers,
  type CharterDetail
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  // (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Social Group operations
  getSocialGroup(id: number): Promise<SocialGroup | undefined>;
  getSocialGroupsByUserId(userId: string): Promise<GroupWithMembers[]>;
  createSocialGroup(group: InsertSocialGroup): Promise<SocialGroup>;
  updateSocialGroup(id: number, updates: Partial<SocialGroup>): Promise<SocialGroup>;

  // Charter operations
  getCharter(id: number): Promise<Charter | undefined>;
  getCharterDetail(id: number): Promise<CharterDetail | undefined>;
  getChartersByUserId(userId: string): Promise<CharterWithGroup[]>;
  createCharter(charter: InsertCharter): Promise<Charter>;
  updateCharter(id: number, updates: Partial<Charter>): Promise<Charter>;
  deleteCharter(id: number): Promise<void>;

  // Group Member operations
  getGroupMembers(groupId: number): Promise<(GroupMember & { user: User })[]>;
  addGroupMember(member: InsertGroupMember): Promise<GroupMember>;
  removeGroupMember(groupId: number, userId: string): Promise<void>;
  updateMemberRole(groupId: number, userId: string, role: string): Promise<GroupMember>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        email: userData.email || null,
        firstName: userData.firstName || null,
        lastName: userData.lastName || null,
        profileImageUrl: userData.profileImageUrl || null,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          email: userData.email || null,
          firstName: userData.firstName || null,
          lastName: userData.lastName || null,
          profileImageUrl: userData.profileImageUrl || null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Social Group operations
  async getSocialGroup(id: number): Promise<SocialGroup | undefined> {
    const [group] = await db.select().from(socialGroups).where(eq(socialGroups.id, id));
    return group;
  }

  async getSocialGroupsByUserId(userId: string): Promise<GroupWithMembers[]> {
    // Get groups where user is a member
    const groupsWithMembers = await db
      .select({
        group: socialGroups,
        member: groupMembers,
        user: users,
        charter: charters,
      })
      .from(socialGroups)
      .leftJoin(groupMembers, eq(socialGroups.id, groupMembers.groupId))
      .leftJoin(users, eq(groupMembers.userId, users.id))
      .leftJoin(charters, eq(socialGroups.id, charters.groupId))
      .where(eq(groupMembers.userId, userId));

    // Group by social group and build the result
    const groupMap = new Map<number, GroupWithMembers>();
    
    for (const row of groupsWithMembers) {
      const groupId = row.group.id;
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          ...row.group,
          members: [],
          charter: row.charter || undefined,
        });
      }
      
      if (row.member && row.user) {
        groupMap.get(groupId)!.members.push({
          ...row.member,
          user: row.user,
        });
      }
    }

    return Array.from(groupMap.values());
  }

  async createSocialGroup(group: InsertSocialGroup): Promise<SocialGroup> {
    const [created] = await db.insert(socialGroups).values(group).returning();
    return created;
  }

  async updateSocialGroup(id: number, updates: Partial<SocialGroup>): Promise<SocialGroup> {
    const [updated] = await db
      .update(socialGroups)
      .set(updates)
      .where(eq(socialGroups.id, id))
      .returning();
    return updated;
  }

  // Charter operations
  async getCharter(id: number): Promise<Charter | undefined> {
    const [charter] = await db.select().from(charters).where(eq(charters.id, id));
    return charter;
  }

  async getCharterDetail(id: number): Promise<CharterDetail | undefined> {
    const charter = await this.getCharter(id);
    if (!charter) return undefined;

    const group = await this.getSocialGroup(charter.groupId!);
    const owner = await this.getUser(charter.ownerId!);
    const members = await this.getGroupMembers(charter.groupId!);

    if (!group || !owner) return undefined;

    return {
      ...charter,
      group,
      owner,
      admins: members.filter(m => m.role === 'admin').map(m => m.user),
      members: members.map(m => m.user),
      stats: {
        totalViews: 156,
        totalPosts: 0,
      },
    };
  }

  async getChartersByUserId(userId: string): Promise<CharterWithGroup[]> {
    const results = await db
      .select({
        charter: charters,
        group: socialGroups,
        owner: users,
      })
      .from(charters)
      .leftJoin(socialGroups, eq(charters.groupId, socialGroups.id))
      .leftJoin(users, eq(charters.ownerId, users.id))
      .where(eq(charters.ownerId, userId));

    return results.map(row => ({
      ...row.charter,
      group: row.group!,
      owner: row.owner!,
    }));
  }

  async createCharter(charter: InsertCharter): Promise<Charter> {
    const [created] = await db.insert(charters).values(charter).returning();
    return created;
  }

  async updateCharter(id: number, updates: Partial<Charter>): Promise<Charter> {
    const [updated] = await db
      .update(charters)
      .set(updates)
      .where(eq(charters.id, id))
      .returning();
    return updated;
  }

  async deleteCharter(id: number): Promise<void> {
    await db.delete(charters).where(eq(charters.id, id));
  }

  // Group Member operations
  async getGroupMembers(groupId: number): Promise<(GroupMember & { user: User })[]> {
    const results = await db
      .select({
        member: groupMembers,
        user: users,
      })
      .from(groupMembers)
      .leftJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, groupId));

    return results.map(row => ({
      ...row.member,
      user: row.user!,
    }));
  }

  async addGroupMember(member: InsertGroupMember): Promise<GroupMember> {
    const [created] = await db.insert(groupMembers).values(member).returning();
    return created;
  }

  async removeGroupMember(groupId: number, userId: string): Promise<void> {
    await db
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      );
  }

  async updateMemberRole(groupId: number, userId: string, role: string): Promise<GroupMember> {
    const [updated] = await db
      .update(groupMembers)
      .set({ role })
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, userId)
        )
      )
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();