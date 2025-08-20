import { AppDataSource } from "../database/data-source";
import { CharterSignature } from "../database/entities/CharterSignature";
import { Group } from "../database/entities/Group";
import { User } from "../database/entities/User";
import { OpenAIService, CharterAnalysisResult } from "./OpenAIService";
import { MessageService } from "./MessageService";

export class CharterSignatureService {
    private signatureRepository = AppDataSource.getRepository(CharterSignature);
    private groupRepository = AppDataSource.getRepository(Group);
    private userRepository = AppDataSource.getRepository(CharterSignature);

    /**
     * Create a new charter signature from webhook data
     */
    async createCharterSignature(webhookData: any): Promise<CharterSignature> {
        try {
            // Extract the data from the webhook payload
            const signatureData = webhookData.data || webhookData;
            
            // Create the charter signature entity
            const charterSignature = this.signatureRepository.create({
                id: signatureData.id,
                groupId: signatureData.group,
                userId: signatureData.user,
                charterHash: signatureData.charterHash,
                signature: signatureData.signature,
                publicKey: signatureData.publicKey,
                message: signatureData.message,
                createdAt: signatureData.createdAt ? new Date(signatureData.createdAt) : new Date(),
                updatedAt: signatureData.updatedAt ? new Date(signatureData.updatedAt) : new Date(),
            });

            // Save to database
            const savedSignature = await this.signatureRepository.save(charterSignature);
            console.log(`✅ Charter signature created in cerberus: ${savedSignature.id}`);
            
            return savedSignature;
        } catch (error) {
            console.error("❌ Error creating charter signature in cerberus:", error);
            throw error;
        }
    }

    /**
     * Get all charter signatures for a specific group
     */
    async getSignaturesForGroup(groupId: string): Promise<CharterSignature[]> {
        try {
            return await this.signatureRepository.find({
                where: { groupId },
                relations: ['user', 'group'],
                order: { createdAt: 'DESC' }
            });
        } catch (error) {
            console.error("❌ Error getting signatures for group:", error);
            throw error;
        }
    }

    /**
     * Get all charter signatures by a specific user
     */
    async getSignaturesByUser(userId: string): Promise<CharterSignature[]> {
        try {
            return await this.signatureRepository.find({
                where: { userId },
                relations: ['group'],
                order: { createdAt: 'DESC' }
            });
        } catch (error) {
            console.error("❌ Error getting signatures by user:", error);
            throw error;
        }
    }

    /**
     * Check if a user has signed a specific charter (by hash)
     */
    async hasUserSignedCharter(groupId: string, userId: string, charterHash: string): Promise<boolean> {
        try {
            const signature = await this.signatureRepository.findOne({
                where: { groupId, userId, charterHash }
            });
            return !!signature;
        } catch (error) {
            console.error("❌ Error checking if user signed charter:", error);
            return false;
        }
    }

    /**
     * Get the latest charter signature for a group
     */
    async getLatestSignatureForGroup(groupId: string): Promise<CharterSignature | null> {
        try {
            return await this.signatureRepository.findOne({
                where: { groupId },
                relations: ['user'],
                order: { createdAt: 'DESC' }
            });
        } catch (error) {
            console.error("❌ Error getting latest signature for group:", error);
            return null;
        }
    }

    /**
     * Delete all signatures for a group (useful when charter content changes)
     */
    async deleteAllSignaturesForGroup(groupId: string): Promise<void> {
        try {
            await this.signatureRepository.delete({ groupId });
            console.log(`🗑️ Deleted all signatures for group: ${groupId}`);
        } catch (error) {
            console.error("❌ Error deleting signatures for group:", error);
            throw error;
        }
    }

    /**
     * Get signature statistics for a group
     */
    async getGroupSignatureStats(groupId: string): Promise<{
        totalSignatures: number;
        uniqueUsers: number;
        lastSignatureDate: Date | null;
    }> {
        try {
            const signatures = await this.signatureRepository.find({
                where: { groupId },
                select: ['userId', 'createdAt']
            });

            const uniqueUsers = new Set(signatures.map(s => s.userId)).size;
            const lastSignatureDate = signatures.length > 0 
                ? new Date(Math.max(...signatures.map(s => s.createdAt.getTime())))
                : null;

            return {
                totalSignatures: signatures.length,
                uniqueUsers,
                lastSignatureDate
            };
        } catch (error) {
            console.error("❌ Error getting signature stats for group:", error);
            throw error;
        }
    }

    /**
     * Analyze charter activation after a new signature
     */
    async analyzeCharterActivation(
        groupId: string,
        messageService: MessageService
    ): Promise<CharterAnalysisResult | null> {
        try {
            const group = await this.groupRepository.findOne({
                where: { id: groupId },
                relations: ['participants', 'charterSignatures']
            });

            if (!group || !group.charter) {
                return null;
            }

            // Check if Cerberus is enabled for this group
            const charterText = group.charter.toLowerCase();
            
            // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
            let watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
            if (!watchdogNameMatch) {
                // Alternative: look for "Watchdog Name: Cerberus" on same line
                watchdogNameMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
            }
            
            if (!watchdogNameMatch || watchdogNameMatch[1].trim() !== 'cerberus') {
                console.log(`Cerberus not enabled for group ${groupId} - watchdog name is not "Cerberus"`);
                return null;
            }

            const currentSignatures = group.charterSignatures.length;
            const totalParticipants = group.participants.length;

            const openaiService = new OpenAIService();
            const analysis = await openaiService.analyzeCharterActivation(
                group.charter,
                currentSignatures,
                totalParticipants
            );

            // Update group's isCharterActive status
            if (group.isCharterActive !== analysis.isActive) {
                group.isCharterActive = analysis.isActive;
                await this.groupRepository.save(group);

                // Post system message about charter status change
                const charterUrl = `${process.env.PUBLIC_GROUP_CHARTER_BASE_URL}`;
                
                if (analysis.isActive) {
                    await messageService.createSystemMessage({
                        text: `🚀 Charter is now ACTIVE!\n\n` +
                              `Reason: ${analysis.reason}\n\n` +
                              `Current Status: ${currentSignatures} signatures (${((currentSignatures / totalParticipants) * 100).toFixed(1)}%)\n\n` +
                              `Next Steps: The charter is now monitoring for violations.\n\n` +
                              `<a href="${charterUrl}" target="_blank">View Charter</a>`,
                        groupId
                    });
                } else {
                    await messageService.createSystemMessage({
                        text: `⏳ Charter Status: INACTIVE\n\n` +
                              `Reason: ${analysis.reason}\n\n` +
                              `Current Status: ${currentSignatures} signatures (${((currentSignatures / totalParticipants) * 100).toFixed(1)}%)\n\n` +
                              `Required: ${analysis.requiredSignatures ? `${analysis.requiredSignatures} signatures` : 'Threshold not met'}\n\n` +
                              `Action: More signatures needed to activate.\n\n` +
                              `<a href="${charterUrl}" target="_blank">View Charter</a>`,
                        groupId
                    });
                }
            }

            return analysis;
        } catch (error) {
            console.error('Error analyzing charter activation:', error);
            return null;
        }
    }

    /**
     * Handle charter text changes
     */
    async handleCharterTextChange(
        groupId: string,
        oldCharter: string | null,
        newCharter: string,
        messageService: MessageService
    ): Promise<void> {
        try {
            // Check if Cerberus is enabled for this group
            const charterText = newCharter.toLowerCase();
            
            // Look for "Watchdog Name:" followed by "**Cerberus**" on next line (handles markdown)
            let watchdogNameMatch = charterText.match(/watchdog name:\s*\n\s*\*\*([^*]+)\*\*/);
            if (!watchdogNameMatch) {
                // Alternative: look for "Watchdog Name: Cerberus" on same line
                watchdogNameMatch = charterText.match(/watchdog name:\s*([^\n\r]+)/);
            }
            
            if (!watchdogNameMatch || watchdogNameMatch[1].trim() !== 'cerberus') {
                console.log(`Cerberus not enabled for group ${groupId} - watchdog name is not "Cerberus"`);
                return;
            }

            // Set charter as inactive
            await this.groupRepository.update(groupId, { isCharterActive: false });

            // Delete all existing signatures
            await this.signatureRepository.delete({ groupId });

            // Analyze changes with OpenAI
            const openaiService = new OpenAIService();
            const changeSummary = await openaiService.analyzeCharterChanges(oldCharter, newCharter);

            // Post system message about charter changes
            const charterUrl = `${process.env.PUBLIC_GROUP_CHARTER_BASE_URL}`;
            
            await messageService.createSystemMessage({
                text: `📝 Charter Updated\n\n` +
                      `Summary: ${changeSummary.summary}\n\n` +
                      `Key Changes:\n${changeSummary.keyChanges.map(change => `• ${change}`).join('\n')}\n\n` +
                      `Action Required: ${changeSummary.actionRequired} Users now need to sign the new charter.\n\n` +
                      `Status: Charter is now INACTIVE until re-signed. Threshold requirements must be met again.\n\n` +
                      `<a href="${charterUrl}" target="_blank">View Charter</a>`,
                groupId
            });

            console.log(`✅ Charter text change handled for group ${groupId}`);
        } catch (error) {
            console.error('Error handling charter text change:', error);
        }
    }
} 