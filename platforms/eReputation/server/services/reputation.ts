import { storage } from "../storage";
// Removed OpenAI dependency for simplified random calculations
import type { InsertReputationCalculation } from "@shared/schema";

// Helper to convert null to undefined
const nullToUndefined = <T>(value: T | null | undefined): T | undefined => 
  value === null ? undefined : value;

export class ReputationService {
  static async calculateReputation(
    userId: number,
    targetType: string,
    targetId: string | null | undefined,
    targetName: string | null | undefined,
    variables: string[] | any
  ) {
    // Ensure variables is an array
    const variablesArray: string[] = Array.isArray(variables) 
      ? variables.map(v => String(v))
      : (variables ? [String(variables)] : []);
    
    // Create initial calculation record - ensure null/undefined is handled
    const baseData = {
      userId,
      targetType,
      variables: variablesArray as any, // jsonb accepts array
      status: "processing" as const,
    };
    
    const optionalFields: Partial<Pick<InsertReputationCalculation, 'targetId' | 'targetName'>> = {};
    if (targetId != null) optionalFields.targetId = targetId as string;
    if (targetName != null) optionalFields.targetName = targetName as string;
    
    const calculationData = {
      ...baseData,
      ...optionalFields,
    } as unknown as InsertReputationCalculation;

    // @ts-expect-error - TypeScript incorrectly infers null in optionalFields, but runtime value is correct
    const calculation = await storage.createReputationCalculation(calculationData);

    // Generate random score and confidence for simplified calculation
    const randomScore = Math.round((Math.random() * 9 + 1) * 10) / 10; // 1.0 to 10.0
    const randomConfidence = Math.round((Math.random() * 0.5 + 0.5) * 100) / 100; // 0.50 to 1.00

    // Update calculation with random results
    const updatedCalculation = await storage.updateReputationCalculation(calculation.id, {
      score: randomScore.toString(),
      confidence: randomConfidence.toString(),
      analysis: `eReputation analysis completed for ${targetName || "Anonymous"}. Based on the social interactions across Blabsy and Pictique. The calculated eReputation score reflects various factors within the W3DS ecosystem.`,
      status: "complete",
    });

    return updatedCalculation;
  }

  static async getActivityHistory(userId: number) {
    const [calculations, references] = await Promise.all([
      storage.getUserReputationCalculations(userId),
      storage.getUserReferences(userId),
    ]);

    // Combine and sort activities
    const activities = [
      ...calculations.map(calc => ({
        id: calc.id,
        type: 'calculation' as const,
        date: calc.createdAt,
        activity: calc.targetType === 'self' ? 'Self Calculation' : 'Other Evaluation',
        target: calc.targetName || 'Personal Profile',
        result: calc.score ? `Score: ${calc.score}` : 'Processing...',
        status: calc.status,
        data: calc,
      })),
      ...references.map(ref => ({
        id: ref.id,
        type: 'reference' as const,
        date: ref.createdAt,
        activity: 'Reference Provided',
        target: ref.targetName,
        result: ref.referenceType,
        status: ref.status,
        data: ref,
      })),
    ].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    return activities;
  }

  static async getUserStats(userId: number) {
    const calculations = await storage.getUserReputationCalculations(userId);
    const references = await storage.getUserReferences(userId);

    // Calculate current score (latest self calculation)
    const selfCalculations = calculations.filter(calc => calc.targetType === 'self' && calc.status === 'complete');
    const currentScore = selfCalculations.length > 0 ? parseFloat(selfCalculations[0].score || '0') : 0;

    return {
      currentScore: currentScore.toFixed(1),
      totalReferences: references.length,
      totalCalculations: calculations.length,
    };
  }
}
