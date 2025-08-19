import cron from 'node-cron';
import { DeadlineCheckService } from './DeadlineCheckService';

export class CronManagerService {
    private deadlineCheckService: DeadlineCheckService;
    private deadlineCheckJob: cron.ScheduledTask | null = null;

    constructor() {
        this.deadlineCheckService = new DeadlineCheckService();
    }

    /**
     * Start all cron jobs
     */
    startAllJobs(): void {
        console.log('Starting cron jobs...');
        
        // Check for expired votes every 10 minutes
        this.startDeadlineCheckJob();
        
        console.log('All cron jobs started successfully');
    }

    /**
     * Stop all cron jobs
     */
    stopAllJobs(): void {
        console.log('Stopping cron jobs...');
        
        if (this.deadlineCheckJob) {
            this.deadlineCheckJob.stop();
            this.deadlineCheckJob = null;
        }
        
        console.log('All cron jobs stopped');
    }

    /**
     * Start the deadline check cron job (runs every 10 minutes)
     */
    private startDeadlineCheckJob(): void {
        // Schedule: every 10 minutes at 0, 10, 20, 30, 40, 50 seconds
        this.deadlineCheckJob = cron.schedule('*/10 * * * *', async () => {
            console.log(`[${new Date().toISOString()}] Running deadline check cron job...`);
            
            try {
                await this.deadlineCheckService.checkExpiredPolls();
                
                // Log statistics for monitoring
                const stats = await this.deadlineCheckService.getDeadlineStats();
                console.log(`[${new Date().toISOString()}] Deadline check completed. Stats:`, stats);
                
            } catch (error) {
                console.error(`[${new Date().toISOString()}] Error in deadline check cron job:`, error);
            }
        }, {
            scheduled: true,
            timezone: "UTC"
        });

        console.log('Deadline check cron job scheduled to run every 10 minutes');
    }

    /**
     * Get the status of all cron jobs
     */
    getJobStatus(): {
        deadlineCheckJob: {
            running: boolean;
            nextRun?: Date;
        };
    } {
        return {
            deadlineCheckJob: {
                running: this.deadlineCheckJob ? true : false,
                nextRun: undefined // node-cron doesn't provide next run time in newer versions
            }
        };
    }

    /**
     * Manually trigger a deadline check (useful for testing)
     */
    async manualDeadlineCheck(): Promise<void> {
        console.log('Manual deadline check triggered...');
        await this.deadlineCheckService.checkExpiredPolls();
    }
} 