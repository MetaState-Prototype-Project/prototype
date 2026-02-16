import { GroupService } from "./GroupService";
import { Group } from "../database/entities/Group";
import { schedule, validate } from 'node-cron';

interface CerberusInterval {
    groupId: string;
    groupName: string;
    cronSchedule: string;
    lastCheck: Date;
    nextCheck: Date;
    cronJob: any; // Using any for now since the type structure changed
}

export class CerberusIntervalService {
    private groupService: GroupService;
    private groupIntervals: Map<string, CerberusInterval> = new Map();
    private openaiApiKey: string | undefined;

    constructor() {
        this.groupService = new GroupService();
        this.openaiApiKey = process.env.OPENAI_API_KEY;
    }

    /**
     * Initialize Cerberus intervals for all groups with charters
     * Only calls OpenAI if no stored schedule exists
     */
    async initializeIntervals(): Promise<void> {
        try {
            console.log("🔧 Initializing Cerberus intervals for all groups...");
            
            const groups = await this.groupService.getAllGroups();
            const groupsWithCharters = groups.filter(group => group.charter && group.charter.trim() !== '');
            
            console.log(`🔧 Found ${groupsWithCharters.length} groups with charters to monitor`);
            
            for (const group of groupsWithCharters) {
                await this.setupGroupInterval(group);
            }
            
            console.log("✅ Cerberus intervals initialized");
        } catch (error) {
            console.error("❌ Error initializing Cerberus intervals:", error);
        }
    }

    /**
     * Setup interval monitoring for a specific group
     * Uses stored schedule if available, otherwise calls OpenAI
     */
    async setupGroupInterval(group: Group): Promise<void> {
        try {
            console.log(`🔧 Setting up interval for group: ${group.name}`);
            
            // Check if we already have a stored schedule for this group
            const existingInterval = this.groupIntervals.get(group.id);
            if (existingInterval) {
                console.log(`🔧 Using existing stored schedule: ${existingInterval.cronSchedule}`);
                return; // Already set up
            }

            // Try to get stored schedule from database (you can implement this)
            const storedSchedule = await this.getStoredSchedule(group.id);
            if (storedSchedule) {
                console.log(`🔧 Using stored schedule from database: ${storedSchedule}`);
                await this.createCronJob(group, storedSchedule);
                return;
            }

            // Only call OpenAI if we don't have a stored schedule
            console.log(`🔧 No stored schedule found, calling OpenAI to extract cron schedule...`);
            const cronSchedule = await this.extractCronScheduleWithAI(group.charter || "");
            
            if (!cronSchedule) {
                console.log(`🔧 No Cerberus interval found in charter for group: ${group.name}`);
                return;
            }

            // Store the schedule for future use
            await this.storeSchedule(group.id, cronSchedule);
            
            // Create the cron job
            await this.createCronJob(group, cronSchedule);
            
        } catch (error) {
            console.error(`❌ Error setting up interval for group ${group.name}:`, error);
        }
    }

    /**
     * Create a cron job for a group
     */
    private async createCronJob(group: Group, cronSchedule: string): Promise<void> {
        try {
            // Clear existing interval if any
            this.clearGroupInterval(group.id);

            // Validate cron schedule
            console.log(`🔍 Validating cron schedule: ${cronSchedule}`);
            try {
                // Test if we can create a cron job with this schedule
                const testJob = schedule(cronSchedule, () => {});
                testJob.stop(); // Stop the test job immediately
                console.log(`✅ Cron schedule validation passed: ${cronSchedule}`);
            } catch (error) {
                console.error(`❌ Invalid cron schedule: ${cronSchedule}`, error);
                return;
            }

            // Create the cron job
            console.log(`🔧 Creating cron job for group "${group.name}": ${cronSchedule}`);
            console.log(`🔍 Cron schedule type: ${typeof cronSchedule}, length: ${cronSchedule.length}`);
            console.log(`🔍 Cron schedule characters: ${cronSchedule.split('').map(c => c.charCodeAt(0)).join(', ')}`);
            
            const cronJob = schedule(cronSchedule, async () => {
                console.log(`🔧 Cron job triggered for group: ${group.name}`);
                await this.runCerberusCheck(group.id, group.name);
            });

            // Calculate next run time
            const nextRun = this.getNextRunTime(cronSchedule);
            
            // Store the interval
            this.groupIntervals.set(group.id, {
                groupId: group.id,
                groupName: group.name,
                cronSchedule,
                lastCheck: new Date(),
                nextCheck: nextRun,
                cronJob
            });

            console.log(`🔧 Cron job created for group "${group.name}": ${cronSchedule}`);
            console.log(`🔧 Next run: ${nextRun.toLocaleString()}`);
            console.log(`🔧 Total active cron jobs: ${this.groupIntervals.size}`);
            
        } catch (error) {
            console.error(`❌ Error creating cron job for group ${group.name}:`, error);
        }
    }

    /**
     * Clear interval for a specific group
     */
    clearGroupInterval(groupId: string): void {
        const existingInterval = this.groupIntervals.get(groupId);
        if (existingInterval) {
            existingInterval.cronJob.stop();
            this.groupIntervals.delete(groupId);
            console.log(`🔧 Cleared Cerberus interval for group: ${groupId}`);
        }
    }

    /**
     * Update interval for a group (e.g., when charter changes)
     * This will call OpenAI to get the new schedule
     */
    async updateGroupInterval(group: Group): Promise<void> {
        console.log(`🔧 Updating Cerberus interval for group: ${group.name}`);
        
        // Clear existing interval
        this.clearGroupInterval(group.id);
        
        // Remove stored schedule
        await this.removeStoredSchedule(group.id);
        
        // Set up new interval (will call OpenAI)
        await this.setupGroupInterval(group);
    }

    /**
     * Remove interval for a group (e.g., when charter is removed)
     */
    async removeGroupInterval(groupId: string): Promise<void> {
        this.clearGroupInterval(groupId);
        await this.removeStoredSchedule(groupId);
        console.log(`🔧 Removed Cerberus interval for group: ${groupId}`);
    }

    /**
     * Run a Cerberus check for a specific group
     */
    private async runCerberusCheck(groupId: string, groupName: string): Promise<void> {
        try {
            console.log(`🔧 Running scheduled Cerberus check for group: ${groupName}`);
            
            // Update last check time
            const groupInterval = this.groupIntervals.get(groupId);
            if (groupInterval) {
                groupInterval.lastCheck = new Date();
                groupInterval.nextCheck = this.getNextRunTime(groupInterval.cronSchedule);
            }

            // Create a fake trigger message to run Cerberus
            const fakeTriggerMessage = {
                id: `scheduled-${Date.now()}`,
                text: "cerberus trigger",
                group: { id: groupId, name: groupName },
                createdAt: new Date()
            };

            // Run the Cerberus analysis by importing the service dynamically
            const { CerberusTriggerService } = await import("./CerberusTriggerService");
            const triggerService = new CerberusTriggerService();
            await triggerService.processCerberusTrigger(fakeTriggerMessage as any);
            
            console.log(`✅ Scheduled Cerberus check completed for group: ${groupName}`);
        } catch (error) {
            console.error(`❌ Error running scheduled Cerberus check for group ${groupName}:`, error);
        }
    }

    /**
     * Extract cron schedule from charter using OpenAI
     */
    private async extractCronScheduleWithAI(charterContent: string): Promise<string | null> {
        if (!this.openaiApiKey) {
            console.log("⚠️ OpenAI API key not configured - cannot extract cron schedule");
            return null;
        }

        try {
            console.log("🤖 Using OpenAI to extract cron schedule from charter...");
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.openaiApiKey}`,
                    'Content-Type': 'application/json',
                },
                                        body: JSON.stringify({
                            model: 'gpt-4o-mini',
                            messages: [
                        {
                            role: 'system',
                            content: `You are a cron schedule extractor. Your job is to find the Cerberus monitoring interval in a group charter and return ONLY a cron expression.

Look for the "Runtime Policy" section and find where it specifies how often Cerberus should run.

Examples of what to look for:
- "every 1 minute" → "*/1 * * * *"
- "every 2 hours" → "0 */2 * * *"  
- "every 1 day" → "0 0 */1 * *"
- "every 30 minutes" → "*/30 * * * *"

If no interval is found, return "none".
If multiple intervals are found, return the most frequent one.
Return ONLY the cron expression, nothing else.`
                        },
                        {
                            role: 'user',
                            content: `Extract the Cerberus monitoring interval from this charter and return ONLY a cron expression:

${charterContent}`
                        }
                    ],
                    max_tokens: 50,
                    temperature: 0
                })
            });

            const data = await response.json();
            const cronSchedule = data.choices?.[0]?.message?.content?.trim();
            
            if (cronSchedule && cronSchedule !== 'none') {
                console.log(`🤖 OpenAI extracted cron schedule: ${cronSchedule}`);
                return cronSchedule;
            } else {
                console.log("🤖 OpenAI found no interval in charter");
                return null;
            }
        } catch (error) {
            console.error("❌ Error using OpenAI to extract cron schedule:", error);
            return null;
        }
    }

    /**
     * Get next run time for a cron schedule
     */
    private getNextRunTime(cronSchedule: string): Date {
        try {
            // This is a simple approximation - in production you might want a more sophisticated approach
            const now = new Date();
            const parts = cronSchedule.split(' ');
            
            if (parts[0].startsWith('*/')) {
                const minutes = parseInt(parts[0].substring(2));
                return new Date(now.getTime() + minutes * 60 * 1000);
            } else if (parts[1].startsWith('*/')) {
                const hours = parseInt(parts[1].substring(2));
                return new Date(now.getTime() + hours * 60 * 60 * 1000);
            } else if (parts[2].startsWith('*/')) {
                const days = parseInt(parts[2].substring(2));
                return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
            }
            
            return new Date(now.getTime() + 60 * 1000); // Default to 1 minute
        } catch (error) {
            return new Date(Date.now() + 60 * 1000); // Default fallback
        }
    }

    /**
     * Store schedule in database (implement this based on your storage)
     */
    private async storeSchedule(groupId: string, cronSchedule: string): Promise<void> {
        // TODO: Implement storage in your database
        // For now, just log it
        console.log(`💾 Storing cron schedule for group ${groupId}: ${cronSchedule}`);
    }

    /**
     * Get stored schedule from database (implement this based on your storage)
     */
    private async getStoredSchedule(groupId: string): Promise<string | null> {
        // TODO: Implement retrieval from your database
        // For now, return null (no stored schedules)
        return null;
    }

    /**
     * Remove stored schedule from database (implement this based on your storage)
     */
    private async removeStoredSchedule(groupId: string): Promise<void> {
        // TODO: Implement removal from your database
        console.log(`🗑️ Removing stored schedule for group ${groupId}`);
    }

    /**
     * Get current interval status for all groups
     */
    getIntervalsStatus(): CerberusInterval[] {
        return Array.from(this.groupIntervals.values());
    }

    /**
     * Cleanup all intervals (for shutdown)
     */
    cleanup(): void {
        console.log("🔧 Cleaning up all Cerberus intervals...");
        for (const [groupId, interval] of this.groupIntervals) {
            interval.cronJob.stop();
        }
        this.groupIntervals.clear();
                console.log("✅ All Cerberus intervals cleaned up");
    }
}