import {
  User,
  UpsertUser,
  InsertUser,
  ReputationCalculation,
  InsertReputationCalculation,
  Reference,
  InsertReference,
  FileUpload,
  InsertFileUpload,
} from "@shared/entities";
import {
  getUserRepository,
  getReputationCalculationRepository,
  getReferenceRepository,
  getFileUploadRepository,
} from "./typeorm-db";

// Interface for storage operations
export interface IStorage {
  // User operations (IMPORTANT: updated for Email/Password Auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Reputation calculations
  createReputationCalculation(calculation: InsertReputationCalculation): Promise<ReputationCalculation>;
  updateReputationCalculation(id: number, updates: Partial<ReputationCalculation>): Promise<ReputationCalculation>;
  getReputationCalculation(id: number): Promise<ReputationCalculation | undefined>;
  getUserReputationCalculations(userId: number): Promise<ReputationCalculation[]>;
  
  // References
  createReference(reference: InsertReference): Promise<Reference>;
  updateReference(id: number, updates: Partial<Reference>): Promise<Reference>;
  getReference(id: number): Promise<Reference | undefined>;
  getUserReferences(userId: number): Promise<Reference[]>;
  
  // File uploads
  createFileUpload(upload: InsertFileUpload): Promise<FileUpload>;
  getFileUpload(id: number): Promise<FileUpload | undefined>;
  getUserFileUploads(userId: number): Promise<FileUpload[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations (Updated for Email/Password Auth)
  async getUser(id: number): Promise<User | undefined> {
    const userRepo = await getUserRepository();
    return await userRepo.findOne({ where: { id } }) as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const userRepo = await getUserRepository();
    return await userRepo.findOne({ where: { email } }) as User | undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const userRepo = await getUserRepository();
    const user = userRepo.create(userData as User);
    return await userRepo.save(user) as User;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const userRepo = await getUserRepository();
    const existingUser = await userRepo.findOne({ where: { id: userData.id! } });
    
    if (existingUser) {
      // Update existing user
      await userRepo.update(userData.id!, {
        ...userData,
        updatedAt: new Date(),
      });
      return await userRepo.findOne({ where: { id: userData.id! } }) as User;
    } else {
      // Create new user
      const user = userRepo.create(userData as User);
      return await userRepo.save(user) as User;
    }
  }

  // Reputation calculations
  async createReputationCalculation(calculation: InsertReputationCalculation): Promise<ReputationCalculation> {
    const repo = await getReputationCalculationRepository();
    const entity = repo.create(calculation as ReputationCalculation);
    return await repo.save(entity) as ReputationCalculation;
  }

  async updateReputationCalculation(id: number, updates: Partial<ReputationCalculation>): Promise<ReputationCalculation> {
    const repo = await getReputationCalculationRepository();
    await repo.update(id, { ...updates, updatedAt: new Date() });
    return await repo.findOne({ where: { id } }) as ReputationCalculation;
  }

  async getReputationCalculation(id: number): Promise<ReputationCalculation | undefined> {
    const repo = await getReputationCalculationRepository();
    return await repo.findOne({ where: { id } }) as ReputationCalculation | undefined;
  }

  async getUserReputationCalculations(userId: number): Promise<ReputationCalculation[]> {
    const repo = await getReputationCalculationRepository();
    return await repo.find({ 
      where: { userId },
      order: { createdAt: "DESC" }
    }) as ReputationCalculation[];
  }

  // References
  async createReference(reference: InsertReference): Promise<Reference> {
    const repo = await getReferenceRepository();
    const entity = repo.create(reference as Reference);
    return await repo.save(entity) as Reference;
  }

  async updateReference(id: number, updates: Partial<Reference>): Promise<Reference> {
    const repo = await getReferenceRepository();
    await repo.update(id, { ...updates, updatedAt: new Date() });
    return await repo.findOne({ where: { id } }) as Reference;
  }

  async getReference(id: number): Promise<Reference | undefined> {
    const repo = await getReferenceRepository();
    return await repo.findOne({ where: { id } }) as Reference | undefined;
  }

  async getUserReferences(userId: number): Promise<Reference[]> {
    const repo = await getReferenceRepository();
    return await repo.find({ 
      where: { authorId: userId },
      order: { createdAt: "DESC" }
    }) as Reference[];
  }

  // File uploads
  async createFileUpload(upload: InsertFileUpload): Promise<FileUpload> {
    const repo = await getFileUploadRepository();
    const entity = repo.create(upload as FileUpload);
    return await repo.save(entity) as FileUpload;
  }

  async getFileUpload(id: number): Promise<FileUpload | undefined> {
    const repo = await getFileUploadRepository();
    return await repo.findOne({ where: { id } }) as FileUpload | undefined;
  }

  async getUserFileUploads(userId: number): Promise<FileUpload[]> {
    const repo = await getFileUploadRepository();
    return await repo.find({ 
      where: { userId },
      order: { createdAt: "DESC" }
    }) as FileUpload[];
  }
}

export const storage = new DatabaseStorage();
