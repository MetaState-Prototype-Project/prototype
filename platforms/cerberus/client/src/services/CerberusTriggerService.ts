import { Message } from "../database/entities/Message";
import { Group } from "../database/entities/Group";
import { MessageService } from "./MessageService";
import { GroupService } from "./GroupService";
import { UserService } from "./UserService";
import { PlatformEVaultService } from "./PlatformEVaultService";
import { VotingContextService } from "./VotingContextService";
import { ReferenceWriterService } from "./ReferenceWriterService";

interface CharterViolation {
    violation: string;
    severity: "low" | "medium" | "high";
    messageId: string;
    senderName: string;
    timestamp: string;
}

interface CharterAnalysisResult {
    violations: CharterViolation[];
    summary: string;
    totalViolations: number;
    groupName: string;
    charterExists: boolean;
}

export class CerberusTriggerService {
    private messageService: MessageService;
    private groupService: GroupService;
    private userService: UserService;
    private platformService: PlatformEVaultService;
    private votingContextService: VotingContextService;
    private referenceWriterService: ReferenceWriterService;
    private openaiApiKey: string;

    constructor() {
        this.messageService = new MessageService();
        this.groupService = new GroupService();
        this.userService = new UserService();
        this.platformService = PlatformEVaultService.getInstance();
        this.votingContextService = new VotingContextService();
        this.referenceWriterService = new ReferenceWriterService();
        this.openaiApiKey = process.env.OPENAI_API_KEY || "";
    }

    /**
     * Check if a message is a Cerberus trigger
     */
    isCerberusTrigger(messageText: string): boolean {
        return messageText.toLowerCase().trim() === "cerberus trigger";
    }

    /**
     * Check if a group has Cerberus enabled (has charter and watchdog name is "Cerberus")
     */
    async isCerberusEnabled(groupId: string): Promise<boolean> {
        try {
            console.log(`🔍 Checking if Cerberus is enabled for group: ${groupId}`);
            const group = await this.groupService.getGroupById(groupId);
            if (!group || !group.charter) {
                console.log(`🔍 Group or charter not found: group=${!!group}, charter=${!!group?.charter}`);
                return false;
            }
            
            console.log(`🔍 Group found with charter length: ${group.charter.length}`);
            
            // Check if the watchdog name is specifically set to "Cerberus"
            const charterText = group.charter.toLowerCase();
            console.log(`🔍 Charter text (first 200 chars): ${charterText.substring(0, 200)}...`);
            
            // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
            const watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
            if (watchdogNameMatch) {
                const watchdogName = watchdogNameMatch[1].trim();
                console.log(`🔍 Found watchdog name (multi-line): "${watchdogName}"`);
                const result = watchdogName === 'cerberus';
                console.log(`🔍 Multi-line match result: ${result}`);
                return result;
            }
            
            // Alternative: look for "Watchdog Name: Cerberus" on same line
            const sameLineMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
            if (sameLineMatch) {
                const watchdogName = sameLineMatch[1].trim();
                console.log(`🔍 Found watchdog name (same-line): "${watchdogName}"`);
                const result = watchdogName === 'cerberus';
                console.log(`🔍 Same-line match result: ${result}`);
                return result;
            }
            
            // Fallback 1: check if "Watchdog Name: Cerberus" appears anywhere
            if (charterText.includes('watchdog name: cerberus')) {
                console.log(`🔍 Fallback 1: Found "watchdog name: cerberus" in charter`);
                return true;
            }
            
            // Fallback 2: check if "Automated Watchdog Policy" section mentions Cerberus
            const policyMatch = charterText.match(/automated\s+watchdog\s+policy[\s\S]{0,500}cerberus/i);
            if (policyMatch) {
                console.log(`🔍 Fallback 2: Found Cerberus in Automated Watchdog Policy section`);
                return true;
            }
            
            // Fallback 3: more permissive - just look for both "watchdog" and "cerberus" in the charter
            const hasBothTerms = charterText.includes('watchdog') && charterText.includes('cerberus');
            if (hasBothTerms) {
                console.log(`🔍 Fallback 3: Found both "watchdog" and "cerberus" terms in charter`);
                return true;
            }
            
            console.log(`🔍 No match found for Cerberus watchdog - charter may not specify Cerberus`);
            return false;
        } catch (error) {
            console.error("Error checking if Cerberus is enabled for group:", error);
            return false;
        }
    }

    /**
     * Check if a message is a Cerberus system message (including "check skipped" messages)
     */
    private isCerberusSystemMessage(message: Message): boolean {
        return message.isSystemMessage && message.text.startsWith('$$system-message$$ Cerberus:');
    }

    /**
     * Find the last message in the group that isn't the current trigger message
     */
    private findLastNonTriggerMessage(messages: Message[], triggerMessageId: string): Message | null {
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.id !== triggerMessageId && !this.isCerberusTrigger(msg.text)) {
                return msg;
            }
        }
        return null;
    }

    /**
     * Get the last message sent by Cerberus in a group
     */
    async getLastCerberusMessage(groupId: string): Promise<Message | null> {
        const messages = await this.messageService.getGroupMessages(groupId);
        
        // Find the last system message that starts with "Cerberus:"
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.isSystemMessage && message.text.startsWith('$$system-message$$ Cerberus:')) {
                return message;
            }
        }

        return null;
    }

    /**
     * Get all messages between the last Cerberus message and the trigger
     */
    async getMessagesSinceLastCerberus(groupId: string, triggerMessageId: string): Promise<Message[]> {
        const lastCerberusMessage = await this.getLastCerberusMessage(groupId);
        const allMessages = await this.messageService.getGroupMessages(groupId);
        
        if (!lastCerberusMessage) {
            // If no previous Cerberus message, get all messages up to the trigger
            return allMessages.filter(msg => 
                msg.id !== triggerMessageId && 
                new Date(msg.createdAt) <= new Date(allMessages.find(m => m.id === triggerMessageId)?.createdAt || 0)
            );
        }

        // Get messages AFTER the last Cerberus message (exclude the Cerberus message itself)
        return allMessages.filter(msg => 
            new Date(msg.createdAt) > new Date(lastCerberusMessage.createdAt)
        );
    }

    /**
     * Process charter changes and send appropriate system messages
     */
    async processCharterChange(groupId: string, groupName: string, oldCharter: string | undefined, newCharter: string): Promise<void> {
        try {
            console.log(`🔍 Processing charter change for group: ${groupId} (${groupName})`);
            console.log(`🔍 Old charter: ${oldCharter ? 'exists' : 'none'}`);
            console.log(`🔍 New charter: ${newCharter ? 'exists' : 'none'}`);
            
            let changeType: 'created' | 'updated' | 'removed';
            
            if (!oldCharter && newCharter) {
                changeType = 'created';
            } else if (oldCharter && !newCharter) {
                changeType = 'removed';
            } else {
                changeType = 'updated';
            }

            console.log(`🔍 Change type determined: ${changeType}`);

            // Check if Cerberus is enabled for this group
            const cerberusEnabled = await this.isCerberusEnabled(groupId);
            console.log(`🔍 Cerberus enabled check result: ${cerberusEnabled}`);
            
            if (!cerberusEnabled) {
                console.log(`Cerberus not enabled for group ${groupId} - sending notification about availability`);
                
                // Send a notification that charter was created/updated but Cerberus is not enabled
                if (changeType === 'created') {
                    // Wait 10 seconds before sending the message
                    console.log(`⏱️ Waiting 10 seconds before sending Cerberus availability notification...`);
                    await new Promise(resolve => setTimeout(resolve, 10_000));
                    
                    const notificationMessage = `$$system-message$$ Cerberus: A new charter has been created for this group. To enable automated charter monitoring and compliance checking by Cerberus, please add "Watchdog Name: Cerberus" to your charter's Automated Watchdog Policy section.`;
                    
                    await this.messageService.createSystemMessageWithoutPrefix({
                        text: notificationMessage,
                        groupId: groupId,
                    });
                    
                    console.log(`✅ Cerberus availability notification sent for new charter`);
                }
                
                return;
            }

            // Wait 10 seconds before sending the charter change message
            await new Promise(resolve => setTimeout(resolve, 10_000));

            // For new charters, analyze activation status and send detailed welcome message
            if (changeType === 'created') {
                try {
                    const { CharterSignatureService } = await import('./CharterSignatureService');
                    const charterSignatureService = new CharterSignatureService();
                    const { OpenAIService } = await import('./OpenAIService');
                    const openaiService = new OpenAIService();
                    
                    // Get charter summary from OpenAI
                    const summary = await openaiService.summarizeCharter(newCharter);
                    
                    // Analyze charter activation - this will also send the appropriate status message
                    await charterSignatureService.analyzeCharterActivation(
                        groupId,
                        this.messageService
                    );
                    
                    // Send welcome message with charter summary
                    const welcomeMessage = `$$system-message$$ Cerberus: New charter created!\n\n📜 Charter Summary:\n${summary.summary}\n\nI will monitor compliance with the charter rules.`;
                    await this.messageService.createSystemMessageWithoutPrefix({
                        text: welcomeMessage,
                        groupId: groupId,
                    });
                } catch (error) {
                    console.error("Error analyzing new charter:", error);
                    // Fallback to simple message
                    const changeMessage = `$$system-message$$ Cerberus: New charter created. I will monitor compliance with the charter rules.`;
                    await this.messageService.createSystemMessageWithoutPrefix({
                        text: changeMessage,
                        groupId: groupId,
                    });
                }
            } else {
                // For updated/removed charters, use simple message
                const changeMessage = `$$system-message$$ Cerberus: Group charter has been ${changeType}. ${
                    changeType === 'removed' ? 'Group is now operating without a charter.' :
                    'Charter has been updated and new rules are now in effect. All previous signatures have been invalidated.'
                }`;

                await this.messageService.createSystemMessageWithoutPrefix({
                    text: changeMessage,
                    groupId: groupId,
                });
            }

            // If charter was updated, also handle signature invalidation and detailed analysis
            if (changeType === 'updated' && oldCharter && newCharter) {
                try {
                    // Import CharterSignatureService dynamically to avoid circular dependencies
                    const { CharterSignatureService } = await import('./CharterSignatureService');
                    const charterSignatureService = new CharterSignatureService();
                    
                    await charterSignatureService.handleCharterTextChange(
                        groupId,
                        oldCharter,
                        newCharter,
                        this.messageService
                    );
                } catch (error) {
                    console.error("Error handling charter signature invalidation:", error);
                }
            }

        } catch (error) {
            console.error("Error processing charter change:", error);
        }
    }

    /**
     * Format time difference in human-readable format
     */
    private formatTimeDifference(minutes: number): string {
        if (minutes < 1) return "less than a minute";
        if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
        if (minutes < 1440) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            if (remainingMinutes === 0) return `${hours} hour${hours === 1 ? '' : 's'}`;
            return `${hours} hour${hours === 1 ? '' : 's'} and ${remainingMinutes} minute${remainingMinutes === 1 ? '' : 's'}`;
        }
        const days = Math.floor(minutes / 1440);
        const remainingHours = Math.floor((minutes % 1440) / 60);
        if (remainingHours === 0) return `${days} day${days === 1 ? '' : 's'}`;
        return `${days} day${days === 1 ? '' : 's'} and ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`;
    }

    /**
     * Find the last voting message in the chat
     */
    private async findLastVotingMessage(groupId: string): Promise<Message | undefined> {
        try {
            const allMessages = await this.messageService.getGroupMessages(groupId);
            
            console.log(`🔍 Searching for eVoting Platform messages in ${allMessages.length} total messages`);
            
            // Look for system messages FROM the eVoting Platform in reverse chronological order
            for (let i = allMessages.length - 1; i >= 0; i--) {
                const message = allMessages[i];
                
                // Check if this is a system message from eVoting Platform
                if (message.isSystemMessage && message.text.startsWith('$$system-message$$ eVoting Platform:')) {
                    console.log(`🔍 Found eVoting Platform message: "${message.text.substring(0, 100)}..." at ${message.createdAt}`);
                    return message;
                }
            }
            
            console.log(`🔍 No eVoting Platform messages found in group ${groupId}`);
            return undefined;
        } catch (error) {
            console.log(`Error finding last eVoting Platform message: ${error}`);
            return undefined;
        }
    }

    /**
     * Analyze messages for charter violations using AI
     */
    async analyzeCharterViolations(messages: Message[], group: Group, lastVoteMessage?: Message): Promise<{
        violations: string[];
        userViolations: Array<{
            userId: string;
            userName: string;
            userEname: string | null;
            violation: string;
            severity: "low" | "medium" | "high";
            score: number;
        }>;
        summary: string;
        hasVotingIssues: boolean;
        votingStatus: string;
        enforcement: string;
    }> {
        if (!this.openaiApiKey) {
            return {
                violations: [],
                userViolations: [],
                summary: "⚠️ OpenAI API key not configured. Cannot analyze charter violations.",
                hasVotingIssues: false,
                votingStatus: "Not analyzed",
                enforcement: "No enforcement possible - API not configured"
            };
        }

        try {
            // Prepare voting context if available
            let votingContext = "";
            if (lastVoteMessage) {
                // Calculate time delta from current time (when analysis is happening)
                const currentTime = new Date();
                
                // Debug: Check what type createdAt actually is
                console.log(`🔍 DEBUG TIMESTAMP TYPES:`);
                console.log(`🔍 lastVoteMessage.createdAt type: ${typeof lastVoteMessage.createdAt}`);
                console.log(`🔍 lastVoteMessage.createdAt constructor: ${lastVoteMessage.createdAt.constructor.name}`);
                console.log(`🔍 lastVoteMessage.createdAt value: ${lastVoteMessage.createdAt}`);
                console.log(`🔍 lastVoteMessage.createdAt instanceof Date: ${lastVoteMessage.createdAt instanceof Date}`);
                
                // Normalize both timestamps to UTC to avoid timezone confusion
                // Since createdAt is already in IST, we need to convert it properly
                const lastVoteTimeUTC = new Date(lastVoteMessage.createdAt.toISOString());
                const currentTimeUTC = new Date(currentTime.toISOString());
                
                const timeSinceLastVote = Math.floor((currentTimeUTC.getTime() - lastVoteTimeUTC.getTime()) / 1000 / 60);
                const humanReadableTime = this.formatTimeDifference(timeSinceLastVote);
                
                // Log the time delta calculation
                console.log(`🔍 TIME DELTA CALCULATION:`);
                console.log(`🔍 Original last vote time: ${lastVoteMessage.createdAt.toString()}`);
                console.log(`🔍 Converted to UTC: ${lastVoteTimeUTC.toISOString()}`);
                console.log(`🔍 Original current time: ${currentTime.toString()}`);
                console.log(`🔍 Converted to UTC: ${currentTimeUTC.toISOString()}`);
                console.log(`🔍 Raw minutes: ${timeSinceLastVote}`);
                console.log(`🔍 Human readable: ${humanReadableTime}`);
                console.log(`🔍 Status: ${timeSinceLastVote > 10 ? 'OVERDUE' : 'Within required interval'}`);
                
                // Extract vote content
                let voteContent = lastVoteMessage.text
                    .replace(/\$\$system-message\$\$/g, '')
                    .replace(/eVoting Platform: New vote created!/g, '')
                    .replace(/Vote ID:.*$/g, '')
                    .trim();
                
                votingContext = `
VOTING CONTEXT:
- Last vote was ${humanReadableTime} ago
- Last vote topic: "${voteContent}"
- Charter requires voting every 10 minutes
- Current status: ${timeSinceLastVote > 10 ? 'OVERDUE' : 'Within required interval'}
`;
                
                console.log(`🔍 VOTING CONTEXT BEING SENT TO AI:`);
                console.log(votingContext);
            }

            // Format messages for analysis — include sender ID and ename for structured violation reporting
            const messagesText = messages.map(msg => {
                const senderInfo = msg.sender
                    ? `${msg.sender.name || 'Unknown'} (id:${msg.sender.id}${msg.sender.ename ? ', ename:' + msg.sender.ename : ''})`
                    : 'System';
                return `[${msg.createdAt.toLocaleString()}] ${senderInfo}: ${msg.text}`;
            }).join('\n');

            const charterText = group.charter || "No charter defined for this group.";

            const systemPrompt = `You are Cerberus, a charter enforcement AI Watchdog, any reference to AI Watchdog in the Charter is meant for you. Your job is to analyze group messages for violations of the group's charter.

IMPORTANT: "cerberus trigger" is a COMMAND to invoke your analysis - it is NOT a violation. Ignore this command when analyzing for violations.

ANALYSIS RULES:
1. Focus on ALL charter violations, not just voting
2. Look for: inappropriate language, spam, harassment, missed deadlines, rule violations
3. For voting: only flag as violation if it's overdue according to charter requirements
4. Be specific about what rule was violated and by whom
5. Provide clear, actionable feedback
6. ALWAYS justify your reasoning for each violation - explain WHY something is a violation
7. ENFORCE any punishment mechanisms or violation handling procedures specified in the charter

VIOLATION CATEGORIES TO CHECK:
- Language violations (profanity, harassment, inappropriate content)
- Spam (excessive messaging, repeated content, rapid-fire messages)
- Behavioral violations (bullying, trolling, off-topic discussions, personal attacks)
- Voting deadline violations (if charter specifies voting frequency)
- Any other rules mentioned in the charter

VIOLATION ANALYSIS REQUIREMENTS:
- For each violation, explain the specific behavior that violated the rule
- Reference the exact charter rule that was broken
- Explain the impact of the violation on the group
- Provide specific examples from the messages
- Suggest how to prevent similar violations in the future
- ENFORCE any punishment mechanisms specified in the charter in anyway
- If the charter specifies consequences for violations, apply them

CHARTER ENFORCEMENT:
- Carefully read the charter for any specified punishment mechanisms
- If punishments are defined (warnings, strikes, timeouts, bans, etc.), enforce them
- Reference the exact charter section that authorizes the punishment
- Explain what punishment is being applied and why

RESPOND WITH ONLY PURE JSON - NO MARKDOWN, NO CODE BLOCKS:
{
    "violations": ["array of detailed violation descriptions with justifications"],
    "userViolations": [
        {
            "userId": "the user's id from the message (id:xxx)",
            "userName": "the user's display name",
            "userEname": "the user's ename if available, or null",
            "violation": "one-sentence description of what rule was violated",
            "severity": "low" | "medium" | "high",
            "score": 1-5 (1 = severe, 5 = minor/warning)
        }
    ],
    "summary": "comprehensive summary with specific examples and actionable recommendations",
    "hasVotingIssues": boolean,
    "votingStatus": "string describing current voting situation with reasoning",
    "enforcement": "string describing any punishments or consequences being applied according to charter rules"
}`;

            const userPrompt = `
GROUP: ${group.name}
CHARTER: ${charterText}
${votingContext}
MESSAGES TO ANALYZE:
${messagesText}

Analyze these messages for charter violations. Focus on ALL types of violations, not just voting. 

FOR EACH VIOLATION FOUND:
- Explain exactly what behavior violated which rule
- Reference the specific charter rule that was broken
- Provide concrete examples from the messages
- Explain the impact on the group
- Suggest how to prevent similar violations

Be thorough and justify your reasoning. Provide clear, actionable recommendations.`;

            const requestBody = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1500
            };

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            
            if (!content) {
                throw new Error("No content in OpenAI response");
            }

            // Parse the JSON response
            try {
                // Strip markdown code fences if present
                let jsonContent = content.trim();
                if (jsonContent.startsWith("```")) {
                    jsonContent = jsonContent.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
                }

                const analysis = JSON.parse(jsonContent);

                // Validate required fields
                if (!Array.isArray(analysis.violations) ||
                    typeof analysis.summary !== 'string' ||
                    typeof analysis.hasVotingIssues !== 'boolean' ||
                    typeof analysis.votingStatus !== 'string' ||
                    typeof analysis.enforcement !== 'string') {
                    throw new Error("Invalid JSON structure from OpenAI");
                }

                // Ensure userViolations exists and is an array
                if (!Array.isArray(analysis.userViolations)) {
                    analysis.userViolations = [];
                }

                return analysis;
                
            } catch (parseError) {
                console.error("Failed to parse OpenAI JSON response:", parseError);
                console.error("Raw response:", content);
                
                return {
                    violations: [],
                    userViolations: [],
                    summary: "❌ Error analyzing messages. Please check the logs.",
                    hasVotingIssues: false,
                    votingStatus: "Error occurred",
                    enforcement: "No enforcement possible - parsing error occurred"
                };
            }

        } catch (error) {
            console.error("Error analyzing with AI:", error);
            return {
                violations: [],
                userViolations: [],
                summary: "❌ Error analyzing charter violations. Please check the logs.",
                hasVotingIssues: false,
                votingStatus: "Error occurred",
                enforcement: "No enforcement possible - analysis error occurred"
            };
        }
    }

    /**
     * Process a Cerberus trigger message
     */
    async processCerberusTrigger(triggerMessage: Message): Promise<void> {
        try {
            // Check if Cerberus is enabled for this group
            const cerberusEnabled = await this.isCerberusEnabled(triggerMessage.group.id);
            if (!cerberusEnabled) {
                console.log(`Cerberus not enabled for group ${triggerMessage.group.id} - skipping trigger processing`);
                return;
            }

            // If the last message was a Cerberus system message or a "check skipped" message,
            // silently return without sending any message to avoid stacking Cerberus messages
            const allGroupMessages = await this.messageService.getGroupMessages(triggerMessage.group.id);
            const lastNonTriggerMessage = this.findLastNonTriggerMessage(allGroupMessages, triggerMessage.id);
            if (lastNonTriggerMessage && this.isCerberusSystemMessage(lastNonTriggerMessage)) {
                console.log(`⏭️ Skipping Cerberus check for group ${triggerMessage.group.id} - previous message was a Cerberus system message`);
                return;
            }

            // Get messages since last Cerberus message
            const messages = await this.getMessagesSinceLastCerberus(
                triggerMessage.group.id,
                triggerMessage.id
            );

            console.log(`📝 Analyzing ${messages.length} messages since last Cerberus analysis`);

            const hasNoMessages = messages.length === 0;
            const hasOnlyTrigger = messages.length === 1 && this.isCerberusTrigger(messages[0].text);

            if (hasNoMessages || hasOnlyTrigger) {
                const skipMessage = `$$system-message$$ Cerberus: check skipped, no messages were sent since the last check`;
                await this.messageService.createSystemMessageWithoutPrefix({
                    text: skipMessage,
                    groupId: triggerMessage.group.id,
                });
                return;
            }

            // Load the group with its charter content
            const groupWithCharter = await this.groupService.getGroupById(triggerMessage.group.id);
            if (!groupWithCharter) {
                console.error("❌ Could not load group with charter");
                return;
            }

            // Find the last voting message for context
            console.log(`🔍 Looking for last voting message in group: ${groupWithCharter.id}`);
            const lastVoteMessage = await this.findLastVotingMessage(groupWithCharter.id);
            
            if (lastVoteMessage) {
                console.log(`🔍 Found last vote: ${lastVoteMessage.text.substring(0, 100)}... at ${lastVoteMessage.createdAt}`);
            } else {
                console.log(`🔍 No voting messages found in this group`);
            }

            // Analyze messages for violations
            const analysis = await this.analyzeCharterViolations(messages, groupWithCharter, lastVoteMessage);

            // Store voting context if there are voting issues
            if (analysis.hasVotingIssues && lastVoteMessage) {
                await this.votingContextService.storeObservation({
                    groupId: triggerMessage.group.id,
                    lastVoteTime: new Date(lastVoteMessage.createdAt),
                    requiredVoteInterval: 600, // 10 minutes in seconds
                    messagesAnalyzed: messages.length,
                    timeRangeStart: messages.length > 0 ? new Date(messages[0].createdAt) : new Date(),
                    timeRangeEnd: new Date(),
                    findings: analysis.summary
                });
            }

            // Write violation references for users who violated the charter
            if (analysis.userViolations && analysis.userViolations.length > 0) {
                try {
                    // Resolve a Cerberus system user as the author of the reference
                    // Use the first group participant as a fallback author, or try "cerberus" ename
                    let authorId: string | null = null;
                    const cerberusUser = await this.referenceWriterService.resolveUserId("cerberus");
                    if (cerberusUser) {
                        authorId = cerberusUser.id;
                    } else {
                        // Use the trigger message sender or first available user
                        const allUsers = await this.userService.getAllUsers();
                        if (allUsers.length > 0) authorId = allUsers[0].id;
                    }

                    if (authorId) {
                        const violationRefs = analysis.userViolations.map((uv: any) => ({
                            targetId: uv.userId,
                            targetName: uv.userName,
                            targetEname: uv.userEname || undefined,
                            content: `[Cerberus - Charter Violation in ${groupWithCharter.name}] ${uv.violation}`,
                            numericScore: Math.max(1, Math.min(5, uv.score || 2))
                        }));

                        await this.referenceWriterService.writeViolationReferences(
                            violationRefs,
                            triggerMessage.group.id,
                            groupWithCharter.name,
                            authorId
                        );
                        console.log(`📝 Wrote ${violationRefs.length} violation references`);
                    } else {
                        console.warn("⚠️ No author user found for violation references");
                    }
                } catch (refError) {
                    console.error("❌ Error writing violation references:", refError);
                }
            }

            // Build the final analysis text
            let analysisText: string;
            if (analysis.violations.length > 0) {
                analysisText = `🚨 CHARTER VIOLATIONS DETECTED!\n\n${analysis.summary}`;

                // Add enforcement information if available
                if (analysis.enforcement && analysis.enforcement !== "No enforcement possible - API not configured") {
                    analysisText += `\n\n⚖️ ENFORCEMENT:\n${analysis.enforcement}`;
                }
            } else {
                analysisText = `✅ NO VIOLATIONS DETECTED\n\n${analysis.summary}`;
            }

            // Add "Cerberus:" prefix and system message prefix
            analysisText = `$$system-message$$ Cerberus: ${analysisText}`;

            // Save the analysis as a system message
            await this.messageService.createSystemMessageWithoutPrefix({
                text: analysisText,
                groupId: triggerMessage.group.id,
            });

        } catch (error) {
            console.error("Error processing Cerberus trigger:", error);
        }
    }
} 