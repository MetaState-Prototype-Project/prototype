import "reflect-metadata";
import { AppDataSource } from "./typeorm.config";
import { Session, User, ReputationCalculation, Reference, FileUpload } from "@shared/entities";

let isInitialized = false;

export async function initializeDatabase() {
  if (!isInitialized) {
    await AppDataSource.initialize();
    isInitialized = true;
    console.log("TypeORM database connection initialized");
  }
  return AppDataSource;
}

export async function getRepository<T>(entity: new () => T) {
  const dataSource = await initializeDatabase();
  return dataSource.getRepository(entity);
}

// Export repositories for easy access
export const getUserRepository = () => getRepository(User);
export const getReputationCalculationRepository = () => getRepository(ReputationCalculation);
export const getReferenceRepository = () => getRepository(Reference);
export const getFileUploadRepository = () => getRepository(FileUpload);
export const getSessionRepository = () => getRepository(Session);

export { AppDataSource };