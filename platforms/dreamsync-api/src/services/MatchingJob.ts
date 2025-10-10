import { AIMatchingService } from "./AIMatchingService";

export class MatchingJob {
    private aiMatchingService: AIMatchingService;
    private intervalId: NodeJS.Timeout | null = null;
    private isRunning: boolean = false;

    constructor() {
        this.aiMatchingService = new AIMatchingService();
    }

    start(intervalMinutes: number = 60): void {
        if (this.intervalId) {
            console.log("⚠️ Matching job is already running");
            return;
        }

        console.log(`🚀 Starting AI matching job (every ${intervalMinutes} minutes)`);
        
        // Run immediately on start
        this.runMatching();

        // Then run on interval
        this.intervalId = setInterval(() => {
            this.runMatching();
        }, intervalMinutes * 60 * 1000);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("🛑 AI matching job stopped");
        }
    }

    private async runMatching(): Promise<void> {
        if (this.isRunning) {
            console.log("⏳ Matching job is already running, skipping...");
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        try {
            console.log(`🔄 Starting AI matching cycle at ${new Date().toISOString()}`);
            await this.aiMatchingService.findMatches();
            
            const duration = Date.now() - startTime;
            console.log(`✅ AI matching cycle completed in ${duration}ms`);
        } catch (error) {
            console.error("❌ Error in AI matching cycle:", error);
        } finally {
            this.isRunning = false;
        }
    }

    async runOnce(): Promise<void> {
        console.log("🎯 Running AI matching once...");
        await this.runMatching();
    }

    getStatus(): { isRunning: boolean; hasInterval: boolean } {
        return {
            isRunning: this.isRunning,
            hasInterval: this.intervalId !== null
        };
    }
}
