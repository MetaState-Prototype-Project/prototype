import OpenAI from 'openai';

export interface CharterAnalysisResult {
    isActive: boolean;
    reason: string;
    thresholdMet: boolean;
    currentSignatures: number;
    requiredSignatures?: number;
    thresholdType?: 'percentage' | 'absolute' | 'none';
}

export interface CharterChangeSummary {
    summary: string;
    keyChanges: string[];
    actionRequired: string;
}

export class OpenAIService {
    private openai: OpenAI;

    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        this.openai = new OpenAI({ apiKey });
    }

    /**
     * Analyze charter signatures to determine if charter should be active
     */
    async analyzeCharterActivation(
        charterText: string,
        currentSignatures: number,
        totalParticipants: number
    ): Promise<CharterAnalysisResult> {
        try {
            const prompt = `
You are an AI assistant that analyzes group charters and determines if they should be considered "active" based on signature requirements.

Charter Text:
${charterText}

Current Status:
- Current Signatures: ${currentSignatures}
- Total Participants: ${totalParticipants}
- Signature Percentage: ${((currentSignatures / totalParticipants) * 100).toFixed(1)}%

Instructions:
1. Look for any signature threshold requirements in the charter text (e.g., "minimum 10% signatures", "at least 5 signatures", etc.)
2. If no threshold is specified, the charter should be active by default
3. If a threshold is specified, determine if it has been met
4. Provide a clear reason for your decision
5. Do NOT use bold formatting with ** symbols in your response

Respond with a JSON object containing:
- isActive: boolean (whether charter should be active)
- reason: string (explanation of decision)
- thresholdMet: boolean (whether threshold was met)
- currentSignatures: number (current signature count)
- requiredSignatures: number or undefined (if threshold specified)
- thresholdType: "percentage" | "absolute" | "none" (type of threshold)
`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            // Try to parse JSON response
            try {
                const result = JSON.parse(content) as CharterAnalysisResult;
                return {
                    ...result,
                    currentSignatures,
                    thresholdMet: result.thresholdMet ?? false,
                };
            } catch (parseError) {
                // Fallback if JSON parsing fails
                console.warn('Failed to parse OpenAI response as JSON, using fallback logic');
                return this.fallbackCharterAnalysis(charterText, currentSignatures, totalParticipants);
            }
        } catch (error) {
            console.error('Error analyzing charter activation:', error);
            return this.fallbackCharterAnalysis(charterText, currentSignatures, totalParticipants);
        }
    }

    /**
     * Analyze charter changes and provide summary
     */
    async analyzeCharterChanges(
        oldCharter: string | null,
        newCharter: string
    ): Promise<CharterChangeSummary> {
        try {
            const prompt = `
You are an AI assistant that analyzes changes to group charters and provides summaries.

Old Charter:
${oldCharter || 'No previous charter'}

New Charter:
${newCharter}

Instructions:
1. Analyze the differences between old and new charter
2. Provide a concise summary of key changes
3. List the main modifications
4. Suggest what actions users might need to do
5. Do NOT use bold formatting with ** symbols in your response
6. In actionRequired, always mention that users need to sign the new charter
7. In summary, always explain what threshold needs to be met for the charter to become active

Respond with a JSON object containing:
- summary: string (brief overview of changes)
- keyChanges: string[] (list of main modifications)
- actionRequired: string (what users need to do)
`;

            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
            });

            const content = response.choices[0]?.message?.content;
            if (!content) {
                throw new Error('No response from OpenAI');
            }

            try {
                return JSON.parse(content) as CharterChangeSummary;
            } catch (parseError) {
                console.warn('Failed to parse OpenAI response as JSON, using fallback');
                return this.fallbackCharterChangeSummary(oldCharter, newCharter);
            }
        } catch (error) {
            console.error('Error analyzing charter changes:', error);
            return this.fallbackCharterChangeSummary(oldCharter, newCharter);
        }
    }

    /**
     * Fallback analysis when OpenAI fails
     */
    private fallbackCharterAnalysis(
        charterText: string,
        currentSignatures: number,
        totalParticipants: number
    ): CharterAnalysisResult {
        // Default behavior: charter is active if no specific threshold mentioned
        const hasThreshold = charterText.toLowerCase().includes('signature') && 
                           (charterText.toLowerCase().includes('minimum') || 
                            charterText.toLowerCase().includes('at least') ||
                            charterText.toLowerCase().includes('required'));

        if (!hasThreshold) {
            return {
                isActive: true,
                reason: 'No signature threshold specified in charter - active by default',
                thresholdMet: true,
                currentSignatures,
                thresholdType: 'none'
            };
        }

        // Simple percentage threshold detection
        const percentageMatch = charterText.match(/(\d+)%/i);
        if (percentageMatch) {
            const requiredPercentage = parseInt(percentageMatch[1]);
            const currentPercentage = (currentSignatures / totalParticipants) * 100;
            const thresholdMet = currentPercentage >= requiredPercentage;

            return {
                isActive: thresholdMet,
                reason: `Charter requires ${requiredPercentage}% signatures. Current: ${currentPercentage.toFixed(1)}%`,
                thresholdMet,
                currentSignatures,
                requiredSignatures: Math.ceil((requiredPercentage / 100) * totalParticipants),
                thresholdType: 'percentage'
            };
        }

        // Simple absolute threshold detection
        const absoluteMatch = charterText.match(/(\d+)\s*signatures?/i);
        if (absoluteMatch) {
            const requiredSignatures = parseInt(absoluteMatch[1]);
            const thresholdMet = currentSignatures >= requiredSignatures;

            return {
                isActive: thresholdMet,
                reason: `Charter requires ${requiredSignatures} signatures. Current: ${currentSignatures}`,
                thresholdMet,
                currentSignatures,
                requiredSignatures,
                thresholdType: 'absolute'
            };
        }

        // Fallback: assume active if we have any signatures
        return {
            isActive: currentSignatures > 0,
            reason: 'Threshold format not recognized, assuming active with signatures',
            thresholdMet: currentSignatures > 0,
            currentSignatures,
            thresholdType: 'none'
        };
    }

    /**
     * Fallback summary when OpenAI fails
     */
    private fallbackCharterChangeSummary(
        oldCharter: string | null,
        newCharter: string
    ): CharterChangeSummary {
        if (!oldCharter) {
                    return {
            summary: 'New charter created. Threshold requirements must be met for activation.',
            keyChanges: ['Charter text added'],
            actionRequired: 'Review and sign the new charter. Users now need to sign the new charter.'
        };
        }

        const oldLength = oldCharter.length;
        const newLength = newCharter.length;
        const lengthDiff = newLength - oldLength;

        return {
            summary: `Charter updated (${lengthDiff > 0 ? '+' : ''}${lengthDiff} characters). Threshold requirements must be met again for activation.`,
            keyChanges: ['Charter text modified'],
            actionRequired: 'Review changes and re-sign the charter. Users now need to sign the new charter.'
        };
    }
} 