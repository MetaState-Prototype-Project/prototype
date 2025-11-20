import { Queue, QueueOptions } from "bullmq";
import Redis from "ioredis";

export interface PollReputationJobData {
    pollId: string;
    eventId: string; // For idempotency
    groupId: string;
}

export class JobQueueService {
    private queue: Queue<PollReputationJobData>;
    private redis: Redis;

    constructor() {
        // Create Redis connection
        this.redis = new Redis({
            host: process.env.REDIS_HOST || "localhost",
            port: parseInt(process.env.REDIS_PORT || "6379", 10),
            maxRetriesPerRequest: null,
        });

        // Create BullMQ queue
        const queueOptions: QueueOptions = {
            connection: {
                host: process.env.REDIS_HOST || "localhost",
                port: parseInt(process.env.REDIS_PORT || "6379", 10),
            },
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 2000,
                },
                removeOnComplete: {
                    age: 3600, // Keep completed jobs for 1 hour
                    count: 1000,
                },
                removeOnFail: {
                    age: 86400, // Keep failed jobs for 24 hours
                },
            },
        };

        this.queue = new Queue<PollReputationJobData>("poll-reputation-calculation", queueOptions);
    }

    /**
     * Enqueue a poll reputation calculation job with deduplication
     */
    async enqueuePollReputationJob(
        pollId: string,
        groupId: string,
        eventId: string
    ): Promise<void> {
        try {
            // Use pollId as the job ID for deduplication (same poll = same job)
            const jobId = `poll-reputation:${pollId}`;

            // Check if job already exists or was recently processed
            const existingJob = await this.queue.getJob(jobId);
            if (existingJob) {
                const state = await existingJob.getState();
                if (state === "active" || state === "waiting" || state === "delayed") {
                    // Job already queued, skip
                    return;
                }
            }

            // Add job with deduplication
            await this.queue.add(
                "calculate-poll-reputation",
                {
                    pollId,
                    groupId,
                    eventId,
                },
                {
                    jobId, // Use pollId as job ID for deduplication
                    removeOnComplete: true,
                    removeOnFail: false,
                }
            );
        } catch (error) {
            throw error;
        }
    }

    /**
     * Close the queue connection
     */
    async close(): Promise<void> {
        await this.queue.close();
        await this.redis.quit();
    }

    getQueue(): Queue<PollReputationJobData> {
        return this.queue;
    }
}

