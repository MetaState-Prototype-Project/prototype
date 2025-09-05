import { db } from "./db";
import { users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function fixUserPasswords() {
  console.log("🔐 Fixing user passwords...");
  
  try {
    // Get all users without passwords
    const allUsers = await db.select().from(users);
    const usersWithoutPasswords = allUsers.filter(user => !user.password);
    
    console.log(`Found ${usersWithoutPasswords.length} users without passwords`);
    
    if (usersWithoutPasswords.length === 0) {
      console.log("✅ All users already have passwords");
      return;
    }
    
    // Hash the default password
    const defaultPassword = "password123";
    const hashedPassword = await hashPassword(defaultPassword);
    
    // Update all users without passwords
    for (const user of usersWithoutPasswords) {
      await db.update(users)
        .set({ password: hashedPassword })
        .where(eq(users.id, user.id));
    }
    
    console.log(`✅ Updated ${usersWithoutPasswords.length} users with default password: ${defaultPassword}`);
  } catch (error) {
    console.error("❌ Error fixing passwords:", error);
    throw error;
  }
}