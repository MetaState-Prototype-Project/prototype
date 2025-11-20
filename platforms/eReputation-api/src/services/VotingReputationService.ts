import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { Group } from "../database/entities/Group";
import { Reference } from "../database/entities/Reference";
import { VoteReputationResult, MemberReputation } from "../database/entities/VoteReputationResult";
import OpenAI from "openai";

export class VotingReputationService {
    private groupRepository: Repository<Group>;
    private referenceRepository: Repository<Reference>;
    private voteReputationResultRepository: Repository<VoteReputationResult>;
    private openai: OpenAI;

    constructor() {
        this.groupRepository = AppDataSource.getRepository(Group);
        this.referenceRepository = AppDataSource.getRepository(Reference);
        this.voteReputationResultRepository = AppDataSource.getRepository(VoteReputationResult);
        
        if (!process.env.OPENAI_API_KEY) {
            throw new Error("OPENAI_API_KEY environment variable is required");
        }
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    /**
     * Calculate eReputation for all group members based on charter rules
     */
    async calculateGroupMemberReputations(
        groupId: string,
        charter: string
    ): Promise<MemberReputation[]> {
        // Get group with all members
        const group = await this.groupRepository.findOne({
            where: { id: groupId },
            relations: ["participants", "admins", "members"]
        });

        if (!group) {
            throw new Error("Group not found");
        }

        // Combine all members (participants + admins + members, removing duplicates)
        const allMembers = new Map<string, typeof group.participants[0]>();
        
        if (group.participants) {
            group.participants.forEach(member => {
                allMembers.set(member.id, member);
            });
        }
        
        if (group.admins) {
            group.admins.forEach(admin => {
                allMembers.set(admin.id, admin);
            });
        }
        
        if (group.members) {
            group.members.forEach(member => {
                allMembers.set(member.id, member);
            });
        }

        const members = Array.from(allMembers.values());
        
        // Filter out members without ename (they can't be used for eReputation voting)
        const membersWithEname = members.filter(member => member.ename);
        
        if (membersWithEname.length === 0) {
            console.log(`⚠️ No members with ename found in group ${groupId}`);
            if (members.length > 0) {
                console.log(`   Found ${members.length} members but none have ename set`);
            }
            return [];
        }
        
        if (membersWithEname.length < members.length) {
            console.log(`⚠️ Filtered out ${members.length - membersWithEname.length} members without ename`);
        }

        console.log(`📋 Starting eReputation calculation for ${membersWithEname.length} group members (with ename):`);
        membersWithEname.forEach((member, index) => {
            console.log(`   ${index + 1}. ${member.name || "Unknown"} (ename: ${member.ename}, ID: ${member.id})`);
        });

        // Fetch all references for all members in parallel
        console.log(`\n🔄 Fetching references for all ${membersWithEname.length} members...`);
        const memberReferencesMap = new Map<string, Array<{ content: string; numericScore?: number; author: string }>>();
        
        const referencePromises = membersWithEname.map(async (member) => {
            const references = await this.referenceRepository.find({
                where: {
                    targetType: "user",
                    targetId: member.id,
                    status: "signed"
                },
                relations: ["author"]
            });
            
            const referencesData = references.map(ref => ({
                content: ref.content,
                numericScore: ref.numericScore,
                author: ref.author.ename || ref.author.name || "Anonymous"
            }));
            
            memberReferencesMap.set(member.id, referencesData);
            return { memberId: member.id, count: references.length };
        });
        
        const referenceResults = await Promise.all(referencePromises);
        referenceResults.forEach(({ memberId, count }) => {
            const member = membersWithEname.find(m => m.id === memberId);
            const memberName = member ? (member.name || "Unknown") : "Unknown";
            const memberEname = member ? member.ename : "Unknown";
            console.log(`   → ${memberName} (${memberEname}): ${count} references`);
        });

        // Calculate all reputations in a single OpenAI call
        console.log(`\n🔄 Calling OpenAI API once for all ${membersWithEname.length} members...`);
        const results = await this.calculateAllMemberReputations(membersWithEname, charter, memberReferencesMap);
        
            console.log(`\n✅ Completed eReputation calculations:`);
            console.log(`   - Total members processed: ${membersWithEname.length}`);
            console.log(`   - Successful calculations: ${results.length}`);
            console.log(`   - Failed calculations: ${membersWithEname.length - results.length}`);
        console.log(`\n📊 eReputation Results for each person:`);
        results.forEach((result, index) => {
            const member = members.find(m => m.ename === result.ename);
            const memberName = member ? (member.name || "Unknown") : "Unknown";
            console.log(`\n   ${index + 1}. ${memberName} (ename: ${result.ename}):`);
            console.log(`      📊 eReputation Score: ${result.score}/5`);
            console.log(`      💬 Justification: "${result.justification}"`);
        });
        
        return results;
    }

    /**
     * Calculate reputation for all members in a single OpenAI call
     */
    private async calculateAllMemberReputations(
        members: Array<{ id: string; ename?: string; name?: string }>,
        charter: string,
        memberReferencesMap: Map<string, Array<{ content: string; numericScore?: number; author: string }>>
    ): Promise<MemberReputation[]> {
        try {
            // Build CSV-like format with all members and their references
            // Use ename (all members should have ename at this point)
            const membersData = members.map(member => {
                if (!member.ename) {
                    throw new Error(`Member ${member.id} (${member.name || "Unknown"}) has no ename`);
                }
                const memberName = member.name || "Unknown";
                const references = memberReferencesMap.get(member.id) || [];
                return {
                    ename: member.ename,
                    userName: memberName,
                    userId: member.id, // Keep for reference lookup
                    references
                };
            });

            // Build prompt for AI
            const prompt = this.buildBulkVotingPrompt(charter, membersData);

            console.log(`   → Sending bulk request to OpenAI with ${members.length} members...`);

            // Call OpenAI once for all members
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert reputation analyst for voting systems. Analyze the group charter and references to calculate reputation scores for voting purposes. Always respond with valid JSON containing an array of results, each with ename (user's ename identifier), score (1-5), and a one-sentence justification."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            });

            const aiResponseContent = response.choices[0].message.content;
            if (!aiResponseContent) {
                throw new Error("AI returned empty response");
            }

            console.log(`   → Received AI response from OpenAI:`);
            console.log(`      Raw response length: ${aiResponseContent.length} characters`);
            console.log(`      First 300 chars: ${aiResponseContent.substring(0, 300)}${aiResponseContent.length > 300 ? '...' : ''}`);
            console.log(`   → Parsing AI response...`);

            let result;
            try {
                result = JSON.parse(aiResponseContent);
                console.log(`   → Successfully parsed JSON response`);
                console.log(`      Results array length: ${Array.isArray(result) ? result.length : 'not an array'}`);
            } catch (parseError) {
                console.error(`   ❌ Failed to parse AI response as JSON:`, parseError);
                throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
            }

            // Validate response is an array
            if (!Array.isArray(result)) {
                console.error(`   ❌ Invalid AI response - not an array:`, result);
                throw new Error("Invalid AI response: expected array of results");
            }

            // Validate and process each result
            const validResults: MemberReputation[] = [];
            result.forEach((item: any, index: number) => {
                // The AI should return ename, but accept userId for backward compatibility
                let ename = item.ename;
                if (!ename && item.userId) {
                    // Fallback: find member by userId and get their ename
                    const member = members.find(m => m.id === item.userId);
                    ename = member?.ename || null;
                }
                
                if (!ename || !item.score || typeof item.score !== 'number' || !item.justification || typeof item.justification !== 'string') {
                    console.error(`   ❌ Invalid result at index ${index}:`, item);
                    return;
                }

                const score = Math.max(1, Math.min(5, Math.round(item.score)));
                const member = members.find(m => m.ename === ename);
                const memberName = member ? (member.name || "Unknown") : "Unknown";

                validResults.push({
                    ename: ename,
                    score,
                    justification: item.justification.trim()
                });

                console.log(`      ✅ Processed result for ${memberName} (ename: ${ename}):`);
                console.log(`         - Raw score: ${item.score}`);
                console.log(`         - Final score: ${score}/5`);
                console.log(`         - Justification: "${item.justification.trim()}"`);
            });

            console.log(`   ✅ Successfully processed ${validResults.length}/${members.length} results from OpenAI`);
            return validResults;
        } catch (error) {
            console.error(`   ❌ ERROR calculating bulk reputations:`, error);
            return [];
        }
    }

    /**
     * Calculate reputation for a single member (deprecated - use calculateAllMemberReputations)
     * Note: This method is deprecated and should not be used. It's kept for reference only.
     */
    private async calculateMemberReputation(
        userId: string,
        userName: string,
        charter: string,
        userEname?: string
    ): Promise<MemberReputation | null> {
        try {
            console.log(`      → Fetching references for ${userName}...`);
            
            // Get all signed references for this user
            const references = await this.referenceRepository.find({
                where: {
                    targetType: "user",
                    targetId: userId,
                    status: "signed"
                },
                relations: ["author"]
            });

            console.log(`      → Found ${references.length} signed references`);

            // Prepare references data
            const referencesData = references.map(ref => ({
                content: ref.content,
                numericScore: ref.numericScore,
                author: ref.author.ename || ref.author.name || "Anonymous"
            }));

            // Build prompt for AI
            const prompt = this.buildVotingPrompt(charter, userName, referencesData);

            console.log(`      → Calling OpenAI API for eReputation calculation...`);

            // Call OpenAI
            const response = await this.openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert reputation analyst for voting systems. Analyze the group charter and references to calculate a reputation score for voting purposes. Always respond with valid JSON containing a score (1-5) and a one-sentence justification."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            });

            const aiResponseContent = response.choices[0].message.content;
            if (!aiResponseContent) {
                throw new Error("AI returned empty response");
            }

            console.log(`      → Received AI response from OpenAI:`);
            console.log(`         Raw response: ${aiResponseContent.substring(0, 200)}${aiResponseContent.length > 200 ? '...' : ''}`);
            console.log(`      → Parsing AI response...`);

            let result;
            try {
                result = JSON.parse(aiResponseContent);
                console.log(`      → Successfully parsed JSON response:`, {
                    score: result.score,
                    hasJustification: !!result.justification,
                    justificationLength: result.justification?.length || 0
                });
            } catch (parseError) {
                console.error(`      ❌ Failed to parse AI response as JSON:`, parseError);
                throw new Error(`Failed to parse AI response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`);
            }

            // Validate response
            if (!result.score || typeof result.score !== 'number') {
                console.error(`      ❌ Invalid AI response - missing or invalid score:`, result);
                throw new Error("Invalid AI response: missing or invalid score");
            }

            if (!result.justification || typeof result.justification !== 'string') {
                console.error(`      ❌ Invalid AI response - missing or invalid justification:`, result);
                throw new Error("Invalid AI response: missing or invalid justification");
            }

            // Ensure score is between 1 and 5
            const rawScore = result.score;
            const score = Math.max(1, Math.min(5, Math.round(result.score)));

            // This method is deprecated - ename should be provided
            if (!userEname) {
                throw new Error("calculateMemberReputation requires ename (deprecated method)");
            }
            
            const memberResult: MemberReputation = {
                ename: userEname,
                score,
                justification: result.justification.trim()
            };

            console.log(`      ✅ Processed OpenAI result for ${userName}:`);
            console.log(`         - Raw score from AI: ${rawScore}`);
            console.log(`         - Final score (rounded/clamped): ${score}/5`);
            console.log(`         - Justification: "${memberResult.justification}"`);
            console.log(`      ✅ Completed: ${userName} - Score: ${score}/5`);
            console.log(`         Justification: ${memberResult.justification}`);

            return memberResult;
        } catch (error) {
            console.error(`      ❌ ERROR calculating reputation for ${userName} (${userId}):`, error);
            return null;
        }
    }

    /**
     * Build prompt for AI to calculate voting reputation for all members at once
     */
    private buildBulkVotingPrompt(
        charter: string,
        membersData: Array<{ ename: string; userName: string; userId: string; references: Array<{ content: string; numericScore?: number; author: string }> }>
    ): string {
        const membersCSV = membersData.map(member => {
            const refsText = member.references.length > 0
                ? member.references.map(ref => 
                    `  - From ${ref.author}${ref.numericScore ? ` (Score: ${ref.numericScore}/5)` : ''}: "${ref.content}"`
                ).join('\n')
                : '  - No references found';
            
            return `USER: ${member.userName} (ename: ${member.ename})
REFERENCES:
${refsText}`;
        }).join('\n\n');

        return `
You are analyzing the reputation of multiple users for voting purposes within a group.

GROUP CHARTER:
${charter}

USERS AND THEIR REFERENCES:
${membersCSV}

TASK:
Based on the group charter and the references provided, calculate a reputation score from 1-5 for EACH user that will be used for weighted voting.

IMPORTANT: 
- Each score must be between 1 and 5 (inclusive)
- Consider how well the references align with the group's charter and values
- Focus on voting-relevant reputation factors mentioned in the charter
- Provide a ONE SENTENCE justification explaining each score

Respond with a JSON array in this exact format:
[
  {
    "ename": "<user's ename identifier>",
    "score": <number between 1-5>,
    "justification": "<one sentence explaining the score based on charter and references>"
  },
  ...
]
        `.trim();
    }

    /**
     * Build prompt for AI to calculate voting reputation (deprecated - use buildBulkVotingPrompt)
     */
    private buildVotingPrompt(
        charter: string,
        userName: string,
        references: Array<{ content: string; numericScore?: number; author: string }>
    ): string {
        return `
You are analyzing the reputation of "${userName}" for voting purposes within a group.

GROUP CHARTER:
${charter}

REFERENCES (what others have said about ${userName}):
${references.length > 0 
    ? references.map(ref => `
Reference from ${ref.author}${ref.numericScore ? ` (Score: ${ref.numericScore}/5)` : ''}:
"${ref.content}"
`).join('\n')
    : 'No references found for this user.'
}

TASK:
Based on the group charter and the references provided, calculate a reputation score from 1-5 for ${userName} that will be used for weighted voting.

IMPORTANT: 
- The score must be between 1 and 5 (inclusive)
- Consider how well the references align with the group's charter and values
- Focus on voting-relevant reputation factors mentioned in the charter
- Provide a ONE SENTENCE justification explaining the score

Respond with a JSON object in this exact format:
{
  "score": <number between 1-5>,
  "justification": "<one sentence explaining the score based on charter and references>"
}
        `.trim();
    }

    /**
     * Save reputation results for a poll
     */
    async saveReputationResults(
        pollId: string,
        groupId: string,
        results: MemberReputation[]
    ): Promise<VoteReputationResult> {
        // Check if result already exists
        let result = await this.voteReputationResultRepository.findOne({
            where: { pollId }
        });

        if (result) {
            result.results = results;
            return await this.voteReputationResultRepository.save(result);
        } else {
            result = this.voteReputationResultRepository.create({
                pollId,
                groupId,
                results
            });
            return await this.voteReputationResultRepository.save(result);
        }
    }

    /**
     * Get reputation results for a poll
     */
    async getReputationResults(pollId: string): Promise<VoteReputationResult | null> {
        return await this.voteReputationResultRepository.findOne({
            where: { pollId },
            relations: ["poll", "group"]
        });
    }
}


