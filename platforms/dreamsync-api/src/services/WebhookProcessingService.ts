import { Repository } from "typeorm";
import { AppDataSource } from "../database/data-source";
import { WebhookProcessing } from "../database/entities/WebhookProcessing";
import crypto from "crypto";

export class WebhookProcessingService {
    private repository: Repository<WebhookProcessing>;

    constructor() {
        this.repository = AppDataSource.getRepository(WebhookProcessing);
    }

    /**
     * Generate a unique webhook ID based on webhook content
     */
    private generateWebhookId(webhookData: any): string {
        // Create a hash of the webhook data to ensure uniqueness
        const dataString = JSON.stringify({
            id: webhookData.id,
            schemaId: webhookData.schemaId,
            data: webhookData.data,
            timestamp: webhookData.timestamp || Date.now()
        });
        return crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 32);
    }

    /**
     * Check if a webhook has already been processed
     */
    async isWebhookProcessed(webhookData: any): Promise<boolean> {
        const webhookId = this.generateWebhookId(webhookData);
        const existing = await this.repository.findOne({
            where: { webhookId }
        });
        return existing !== null;
    }

    /**
     * Mark a webhook as being processed
     */
    async markWebhookProcessing(webhookData: any): Promise<WebhookProcessing> {
        const webhookId = this.generateWebhookId(webhookData);
        const globalId = webhookData.id;
        const schemaId = webhookData.schemaId;
        const tableName = webhookData.data?.tableName || "unknown";
        
        try {
            const processing = this.repository.create({
                webhookId,
                globalId,
                schemaId,
                tableName,
                status: "processing",
                webhookData: webhookData // Store full data for debugging
            });
            return await this.repository.save(processing);
        } catch (error) {
            // If it's a duplicate key error, the webhook is already being processed
            if ((error as any).code === '23505') { // PostgreSQL unique violation
                console.log(`🔄 Webhook ${webhookId} is already being processed`);
                throw new Error(`Webhook ${webhookId} is already being processed`);
            }
            throw error;
        }
    }

    /**
     * Mark a webhook as completed
     */
    async markWebhookCompleted(webhookData: any, localId?: string): Promise<void> {
        const webhookId = this.generateWebhookId(webhookData);
        await this.repository.update(
            { webhookId },
            { 
                status: "completed",
                localId,
                completedAt: new Date()
            }
        );
    }

    /**
     * Mark a webhook as failed
     */
    async markWebhookFailed(webhookData: any, errorMessage: string): Promise<void> {
        const webhookId = this.generateWebhookId(webhookData);
        await this.repository.update(
            { webhookId },
            { 
                status: "failed",
                errorMessage,
                completedAt: new Date()
            }
        );
    }

    /**
     * Clean up old processing records (older than 1 hour)
     */
    async cleanupOldRecords(): Promise<void> {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        await this.repository.delete({
            createdAt: { $lt: oneHourAgo } as any
        });
    }

    /**
     * Get processing statistics
     */
    async getProcessingStats(): Promise<{
        total: number;
        pending: number;
        processing: number;
        completed: number;
        failed: number;
    }> {
        const stats = await this.repository
            .createQueryBuilder("webhook")
            .select("status")
            .addSelect("COUNT(*)", "count")
            .groupBy("status")
            .getRawMany();

        const result = {
            total: 0,
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0
        };

        for (const stat of stats) {
            const count = parseInt(stat.count);
            result.total += count;
            result[stat.status as keyof typeof result] = count;
        }

        return result;
    }
}
