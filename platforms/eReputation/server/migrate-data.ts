import "reflect-metadata";
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws"; 
import * as drizzleSchema from '../shared/schema-backup';
import { initializeDatabase, getUserRepository, getReputationCalculationRepository, getReferenceRepository, getFileUploadRepository, getSessionRepository } from './typeorm-db';
import { User, ReputationCalculation, Reference, FileUpload, Session } from '@shared/entities';

// neonConfig for Drizzle connection
const neonConfig = { webSocketConstructor: ws };

async function migrateData() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
  }

  console.log("Starting data migration from Drizzle to TypeORM...");

  // Initialize TypeORM
  await initializeDatabase();
  
  // Create Drizzle connection to read existing data
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const drizzleDb = drizzle({ client: pool, schema: drizzleSchema });

  try {
    // Get TypeORM repositories
    const userRepo = await getUserRepository();
    const reputationRepo = await getReputationCalculationRepository();
    const referenceRepo = await getReferenceRepository();
    const fileUploadRepo = await getFileUploadRepository();
    const sessionRepo = await getSessionRepository();

    // Migrate Users
    console.log("Migrating users...");
    const drizzleUsers = await drizzleDb.select().from(drizzleSchema.users);
    console.log(`Found ${drizzleUsers.length} users to migrate`);
    
    for (const user of drizzleUsers) {
      // Check if user already exists in TypeORM
      const existingUser = await userRepo.findOne({ where: { id: user.id } });
      if (!existingUser) {
        const newUser = userRepo.create({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        });
        await userRepo.save(newUser);
        console.log(`Migrated user: ${user.id}`);
      } else {
        console.log(`User ${user.id} already exists, skipping`);
      }
    }

    // Migrate Sessions
    console.log("Migrating sessions...");
    const drizzleSessions = await drizzleDb.select().from(drizzleSchema.sessions);
    console.log(`Found ${drizzleSessions.length} sessions to migrate`);
    
    for (const session of drizzleSessions) {
      const existingSession = await sessionRepo.findOne({ where: { sid: session.sid } });
      if (!existingSession) {
        const newSession = sessionRepo.create({
          sid: session.sid,
          sess: session.sess,
          expire: session.expire,
        });
        await sessionRepo.save(newSession);
        console.log(`Migrated session: ${session.sid}`);
      }
    }

    // Migrate Reputation Calculations
    console.log("Migrating reputation calculations...");
    const drizzleCalculations = await drizzleDb.select().from(drizzleSchema.reputationCalculations);
    console.log(`Found ${drizzleCalculations.length} calculations to migrate`);
    
    for (const calc of drizzleCalculations) {
      const existingCalc = await reputationRepo.findOne({ where: { id: calc.id } });
      if (!existingCalc) {
        const newCalc = reputationRepo.create({
          id: calc.id,
          userId: calc.userId,
          targetType: calc.targetType,
          targetId: calc.targetId,
          targetName: calc.targetName,
          variables: calc.variables,
          score: calc.score,
          confidence: calc.confidence,
          analysis: calc.analysis,
          isPublic: calc.isPublic,
          status: calc.status,
          createdAt: calc.createdAt,
          updatedAt: calc.updatedAt,
        });
        await reputationRepo.save(newCalc);
        console.log(`Migrated calculation: ${calc.id}`);
      }
    }

    // Migrate References
    console.log("Migrating references...");
    const drizzleReferences = await drizzleDb.select().from(drizzleSchema.references);
    console.log(`Found ${drizzleReferences.length} references to migrate`);
    
    for (const ref of drizzleReferences) {
      const existingRef = await referenceRepo.findOne({ where: { id: ref.id } });
      if (!existingRef) {
        const newRef = referenceRepo.create({
          id: ref.id,
          authorId: ref.authorId,
          targetType: ref.targetType,
          targetId: ref.targetId,
          targetName: ref.targetName,
          referenceType: ref.referenceType,
          content: ref.content,
          attachments: ref.attachments,
          status: ref.status,
          createdAt: ref.createdAt,
          updatedAt: ref.updatedAt,
        });
        await referenceRepo.save(newRef);
        console.log(`Migrated reference: ${ref.id}`);
      }
    }

    // Migrate File Uploads
    console.log("Migrating file uploads...");
    const drizzleFileUploads = await drizzleDb.select().from(drizzleSchema.fileUploads);
    console.log(`Found ${drizzleFileUploads.length} file uploads to migrate`);
    
    for (const file of drizzleFileUploads) {
      const existingFile = await fileUploadRepo.findOne({ where: { id: file.id } });
      if (!existingFile) {
        const newFile = fileUploadRepo.create({
          id: file.id,
          userId: file.userId,
          filename: file.filename,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          url: file.url,
          referenceId: file.referenceId,
          createdAt: file.createdAt,
        });
        await fileUploadRepo.save(newFile);
        console.log(`Migrated file upload: ${file.id}`);
      }
    }

    console.log("Data migration completed successfully!");
    
  } catch (error) {
    console.error("Error during migration:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateData()
    .then(() => {
      console.log("Migration finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}

export { migrateData };