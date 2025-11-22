import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Calculation } from "../database/entities/Calculation";
import { Reference } from "../database/entities/Reference";
import { Wishlist } from "../database/entities/Wishlist";
import OpenAI from "openai";

export class CalculationService {
    calculationRepository: Repository<Calculation>;
    referenceRepository: Repository<Reference>;
    wishlistRepository: Repository<Wishlist>;
    private openai: OpenAI;

    constructor() {
        this.calculationRepository = AppDataSource.getRepository(Calculation);
        this.referenceRepository = AppDataSource.getRepository(Reference);
        this.wishlistRepository = AppDataSource.getRepository(Wishlist);
        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is required");
        }
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    async createCalculation(data: {
        targetType: string;
        targetId: string;
        targetName: string;
        userValues: string;
        calculatorId: string;
    }): Promise<Calculation> {
        const calculation = this.calculationRepository.create({
            ...data,
            status: "processing",
            calculatedScore: 0
        });
        return await this.calculationRepository.save(calculation);
    }

    async calculateReputation(calculationId: string): Promise<Calculation> {
        const calculation = await this.calculationRepository.findOne({
            where: { id: calculationId }
        });

        if (!calculation) {
            throw new Error("Calculation not found");
        }

        try {
            // Get all references for this target
            // For self-evaluation, references are stored with targetType "user", not "self"
            const referenceTargetType = calculation.targetType === "self" ? "user" : calculation.targetType;
            const references = await this.referenceRepository.find({
                where: { 
                    targetType: referenceTargetType, 
                    targetId: calculation.targetId,
                    status: "signed" // Only include signed references
                },
                relations: ["author"]
            });

            if (references.length === 0) {
                // Determine target type for explanation message
                let targetTypeLabel = "person";
                if (calculation.targetType === "group") {
                    targetTypeLabel = "group";
                } else if (calculation.targetType === "platform") {
                    targetTypeLabel = "platform";
                } else if (calculation.targetType === "self") {
                    targetTypeLabel = "person";
                }
                
                calculation.calculatedScore = 0;
                calculation.status = "complete";
                calculation.calculationDetails = JSON.stringify({
                    explanation: `This ${targetTypeLabel} has no eReferences, so the score is inconclusive.`,
                    referencesCount: 0,
                    referencesAnalyzed: 0,
                    userValues: calculation.userValues
                });
                return await this.calculationRepository.save(calculation);
            }

            // Prepare data for OpenAI
            const referencesData = references.map(ref => ({
                content: ref.content,
                numericScore: ref.numericScore,
                author: ref.author.ename || ref.author.name || "Anonymous"
            }));

            // Fetch user's wishlist if userValues is not provided or empty
            let effectiveUserValues = calculation.userValues;
            if (!effectiveUserValues || !effectiveUserValues.trim()) {
                const wishlists = await this.wishlistRepository.find({
                    where: {
                        userId: calculation.calculatorId,
                        isActive: true
                    },
                    order: { updatedAt: "DESC" },
                    take: 1 // Get the most recent active wishlist
                });
                
                if (wishlists.length > 0 && wishlists[0].content && wishlists[0].content.trim()) {
                    effectiveUserValues = wishlists[0].content;
                } else {
                    effectiveUserValues = "General good qualities: integrity, reliability, constructive contributions, respectfulness, and positive interactions.";
                }
            }

            const prompt = this.buildPrompt(effectiveUserValues, referencesData, calculation.targetName);

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert reputation analyst. You analyze references and calculate reputation scores based on user values. Always respond with a valid JSON object containing a score (1-5) and explanation."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            });

            const aiResponseContent = response.choices[0].message.content;
            if (!aiResponseContent) {
                throw new Error("AI returned empty response");
            }

            let result;
            try {
                result = JSON.parse(aiResponseContent);
            } catch (parseError) {
                throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
            }
            
            // Validate that we got a proper score from AI
            if (!result.score || typeof result.score !== 'number') {
                throw new Error("Invalid AI response: missing or invalid score");
            }
            
            calculation.calculatedScore = Math.max(1, Math.min(5, result.score || 0));
            calculation.status = "complete";
            calculation.calculationDetails = JSON.stringify({
                explanation: result.explanation || "No explanation provided",
                referencesCount: references.length,
                referencesAnalyzed: referencesData.length,
                userValues: calculation.userValues
            });

            return await this.calculationRepository.save(calculation);

        } catch (error) {
            console.error("Error calculating reputation:", error);
            // Delete the calculation if there was an error getting the AI score
            // Don't save failed calculations to the database
            await this.calculationRepository.remove(calculation);
            throw error; // Re-throw so controller can handle it
        }
    }

    private buildPrompt(userValues: string, references: any[], targetName: string): string {
        return `
You are analyzing the reputation of "${targetName}" based on the following user values and references. Remember that the user may also supply a wishlist, only focus on the part of the wishlist and values which mentions what the user values in a person, group, or platform, depending on what type of profile it is that you are evaluating, do not care about anything else in the wishlist.

USER VALUES (what the evaluator cares about):
${userValues}

REFERENCES (what others have said about ${targetName}):
${references.map(ref => `
Reference from ${ref.author} (Score: ${ref.numericScore}/5):
"${ref.content}"
`).join('\n')}

TASK:
Based on the user's values and the references provided, calculate a reputation score from 1-5 for ${targetName}.

IMPORTANT: The score must be between 1 and 5 (inclusive). Use the full range:
- 1 = Very poor reputation
- 2 = Poor reputation  
- 3 = Average reputation
- 4 = Good reputation
- 5 = Excellent reputation

Consider:
1. How well the references align with what the user values
2. The quality and consistency of the references
3. The numeric scores given by the reference authors
4. Whether the references address the user's specific values

Respond with a JSON object in this exact format:
{
  "score": <number between 1-5>,
  "explanation": "<detailed explanation of how you calculated this score based on the user's values and the references>"
}
        `.trim();
    }

    async getCalculationById(id: string): Promise<Calculation | null> {
        return await this.calculationRepository.findOne({
            where: { id },
            relations: ["calculator"]
        });
    }

    async getUserCalculations(calculatorId: string): Promise<Calculation[]> {
        return await this.calculationRepository.find({
            where: { calculatorId },
            order: { createdAt: "DESC" }
        });
    }
}
