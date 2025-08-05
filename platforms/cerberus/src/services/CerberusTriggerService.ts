import { Message } from "../database/entities/Message";
import { Group } from "../database/entities/Group";
import { MessageService } from "./MessageService";
import { GroupService } from "./GroupService";
import { UserService } from "./UserService";
import { PlatformEVaultService } from "./PlatformEVaultService";

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
    private openaiApiKey: string;

    constructor() {
        this.messageService = new MessageService();
        this.groupService = new GroupService();
        this.userService = new UserService();
        this.platformService = PlatformEVaultService.getInstance();
        this.openaiApiKey = process.env.OPENAI_API_KEY || "";
    }

    /**
     * Check if a message is a Cerberus trigger
     */
    isCerberusTrigger(messageText: string): boolean {
        return messageText.toLowerCase().trim() === "cerberus trigger";
    }

    /**
     * Get the last message sent by Cerberus in a group
     */
    async getLastCerberusMessage(groupId: string): Promise<Message | null> {
        const platformEName = await this.platformService.getPlatformEName();
        if (!platformEName) {
            console.error("Platform eName not found");
            return null;
        }

        // Get all messages in the group, ordered by creation date
        const messages = await this.messageService.getGroupMessages(groupId);
        
        // Find the last message sent by Cerberus (platform)
        for (let i = messages.length - 1; i >= 0; i--) {
            const message = messages[i];
            if (message.sender.ename === platformEName) {
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

        // Get messages between last Cerberus message and trigger
        return allMessages.filter(msg => 
            msg.id !== triggerMessageId &&
            new Date(msg.createdAt) > new Date(lastCerberusMessage.createdAt) &&
            new Date(msg.createdAt) <= new Date(allMessages.find(m => m.id === triggerMessageId)?.createdAt || 0)
        );
    }

    /**
     * Analyze messages for charter violations using OpenAI and return human-readable response
     */
    async analyzeCharterViolations(
        messages: Message[], 
        group: Group, 
        triggerMessageId: string
    ): Promise<string> {
        if (!this.openaiApiKey) {
            return "⚠️ OpenAI API key not configured. Cannot analyze charter violations.";
        }

        console.log("GROUP", group)

        try {
            const messagesText = messages.map(msg => 
                `[${msg.createdAt}] ${msg.sender.name}: ${msg.text}`
            ).join('\n');

            const charterText = group.charter || "No charter defined for this group.";

            const prompt = `
You are Cerberus, a charter enforcement AI. Analyze the following messages for violations of the group's charter.

GROUP: ${group.name}
CHARTER:
${charterText}

MESSAGES TO ANALYZE:
${messagesText}

Please analyze these messages and provide a clear, human-readable report of any charter violations found. 

Your response should be:
- Written in a professional but friendly tone
- Include specific violations with severity levels
- Mention who committed the violations
- Provide a summary of findings
- If no violations are found, acknowledge that

Write your response as a natural message that would be sent to the group chat.
`;

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are Cerberus, a charter enforcement AI. Provide clear, human-readable analysis of charter violations.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const data = await response.json();
            const content = data.choices[0]?.message?.content;
            
            if (!content) {
                throw new Error("No content in OpenAI response");
            }

            return content;

        } catch (error) {
            console.error("Error analyzing charter violations:", error);
            return `❌ Error analyzing charter violations: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }

    /**
     * Process a Cerberus trigger message
     */
    async processCerberusTrigger(triggerMessage: Message): Promise<void> {
        console.log(`🔍 Processing Cerberus trigger in group: ${triggerMessage.group.name}`);

        try {
            // Get messages since last Cerberus message
            const messages = await this.getMessagesSinceLastCerberus(
                triggerMessage.group.id, 
                triggerMessage.id
            );

            console.log(`📝 Found ${messages.length} messages to analyze`);

            // Analyze for charter violations
            const analysisText = await this.analyzeCharterViolations(
                messages, 
                triggerMessage.group, 
                triggerMessage.id
            );

            console.log("🤖 Analysis completed, saving response as message...");

            // Get the Cerberus platform user
            const platformEName = await this.platformService.getPlatformEName();
            if (!platformEName) {
                console.error("Platform eName not found, cannot save response message");
                return;
            }

            // Find or create the Cerberus user in the database
            let cerberusUser = await this.userService.userRepository.findOne({
                where: { name: "Cerberus Platform" }
            });
            if (!cerberusUser) {
                console.log("Creating Cerberus platform user...");
                cerberusUser = await this.userService.createUser({
                    ename: platformEName,
                    name: "Cerberus Platform",
                    handle: "cerberus",
                    description: "Charter enforcement AI",
                    avatarUrl: undefined,
                    bannerUrl: undefined,
                    isVerified: true,
                    isPrivate: false,
                });
            }

            // Save the analysis as a message from Cerberus
            const responseMessage = await this.messageService.createMessage({
                text: analysisText,
                senderId: cerberusUser.id,
                groupId: triggerMessage.group.id,
            });

            console.log(responseMessage)

            console.log(`✅ Charter analysis saved as message: ${responseMessage.id}`);
            console.log(`📝 Response: ${analysisText.substring(0, 100)}...`);

        } catch (error) {
            console.error("Error processing Cerberus trigger:", error);
        }
    }
} 