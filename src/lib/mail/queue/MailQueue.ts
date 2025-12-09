import crypto from "crypto";
import { Mailable } from "../Mailable";
import { MailQueueConfig, MailSendResult } from "../types";

/**
 * Queue job priority
 */
type JobPriority = "high" | "normal" | "low";

/**
 * Job status
 */
type JobStatus = "pending" | "processing" | "completed" | "failed" | "dead";

/**
 * Queue job for email sending
 */
interface MailJob {
  id: string;
  mailable: Mailable;
  attempts: number;
  maxRetries: number;
  priority: JobPriority;
  status: JobStatus;
  createdAt: Date;
  processAt?: Date;
  nextRetry?: Date;
  lastError?: string;
  result?: MailSendResult;
}

/**
 * Serialized job for Redis storage
 */
interface SerializedJob {
  id: string;
  mailableData: Record<string, any>;
  mailableClass: string;
  attempts: number;
  maxRetries: number;
  priority: JobPriority;
  status: JobStatus;
  createdAt: string;
  processAt?: string;
  nextRetry?: string;
  lastError?: string;
}

/**
 * Queue statistics
 */
interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead: number;
  totalProcessed: number;
  avgProcessingTime: number;
}

/**
 * Job add options
 */
interface JobAddOptions {
  priority?: JobPriority;
  delay?: number;
  maxRetries?: number;
}

/**
 * Event handler types
 */
type QueueEventType =
  | "job:added"
  | "job:completed"
  | "job:failed"
  | "job:dead"
  | "queue:drained";
type QueueEventHandler = (data: any) => void;

/**
 * Mail queue for async email processing
 * Features: priority queues, dead letter queue, concurrency control, event hooks
 */
export class MailQueue {
  private static config?: MailQueueConfig;
  private static queues = {
    high: [] as MailJob[],
    normal: [] as MailJob[],
    low: [] as MailJob[],
  };
  private static processing = false;
  private static processingCount = 0;
  private static shuttingDown = false;
  private static redisClient?: any;
  private static stats = {
    totalProcessed: 0,
    totalTime: 0,
    completed: 0,
    failed: 0,
    dead: 0,
  };
  private static eventHandlers: Map<QueueEventType, QueueEventHandler[]> =
    new Map();
  private static processingInterval?: NodeJS.Timeout;

  /**
   * Initialize the mail queue
   */
  static async init(config: MailQueueConfig): Promise<void> {
    this.config = config;
    this.shuttingDown = false;

    if (config.driver === "redis" && config.redis) {
      await this.initRedis(config.redis);
    }

    // Start processing queue
    this.startProcessing();
  }

  /**
   * Initialize Redis connection
   */
  private static async initRedis(
    redisConfig: NonNullable<MailQueueConfig["redis"]>
  ): Promise<void> {
    try {
      const Redis = require("ioredis");
      this.redisClient = new Redis({
        host: redisConfig.host,
        port: redisConfig.port,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        retryStrategy: (times: number) => {
          if (times > 10) {
            console.error(
              "Redis connection lost, falling back to memory queue"
            );
            this.config!.driver = "memory";
            return null;
          }
          return Math.min(times * 100, 3000);
        },
      });

      this.redisClient.on("error", (err: Error) => {
        console.error("Redis connection error:", err);
      });

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        this.redisClient.once("ready", resolve);
        this.redisClient.once("error", reject);
        setTimeout(() => reject(new Error("Redis connection timeout")), 5000);
      });
    } catch (error) {
      console.warn(
        "Redis not available, falling back to memory queue:",
        (error as Error).message
      );
      this.config!.driver = "memory";
    }
  }

  /**
   * Add a job to the queue
   */
  static async add(
    mailable: Mailable,
    options?: JobAddOptions
  ): Promise<string> {
    const priority = options?.priority || "normal";
    const job: MailJob = {
      id: this.generateId(),
      mailable,
      attempts: 0,
      maxRetries: options?.maxRetries ?? this.config?.retries ?? 3,
      priority,
      status: "pending",
      createdAt: new Date(),
      processAt: options?.delay
        ? new Date(Date.now() + options.delay)
        : undefined,
    };

    if (this.config?.driver === "redis" && this.redisClient) {
      await this.addToRedis(job);
    } else {
      this.queues[priority].push(job);
    }

    this.emit("job:added", { jobId: job.id, priority });
    return job.id;
  }

  /**
   * Add job to Redis queue
   */
  private static async addToRedis(job: MailJob): Promise<void> {
    const serialized = this.serializeJob(job);
    const key = `mail:queue:${job.priority}`;

    if (job.processAt && job.processAt > new Date()) {
      // Delayed job - use sorted set
      await this.redisClient.zadd(
        "mail:delayed",
        job.processAt.getTime(),
        JSON.stringify(serialized)
      );
    } else {
      await this.redisClient.lpush(key, JSON.stringify(serialized));
    }
  }

  /**
   * Serialize job for storage
   */
  private static serializeJob(job: MailJob): SerializedJob {
    const { message, viewName, viewData } = job.mailable.getMessage();
    return {
      id: job.id,
      mailableData: { message, viewName, viewData },
      mailableClass: job.mailable.constructor.name,
      attempts: job.attempts,
      maxRetries: job.maxRetries,
      priority: job.priority,
      status: job.status,
      createdAt: job.createdAt.toISOString(),
      processAt: job.processAt?.toISOString(),
      nextRetry: job.nextRetry?.toISOString(),
      lastError: job.lastError,
    };
  }

  /**
   * Start processing the queue
   */
  private static startProcessing(): void {
    if (this.processing) return;
    this.processing = true;

    const interval = this.config?.pollInterval || 1000;
    this.processingInterval = setInterval(async () => {
      if (this.shuttingDown) return;

      // Check delayed jobs
      await this.promoteDelayedJobs();

      // Process jobs up to concurrency limit
      const concurrency = this.config?.concurrency || 1;
      while (this.processingCount < concurrency) {
        const hasJob = await this.processNext();
        if (!hasJob) break;
      }

      // Check if queue is drained
      const size = await this.size();
      if (size === 0 && this.processingCount === 0) {
        this.emit("queue:drained", {});
      }
    }, interval);
  }

  /**
   * Promote delayed jobs that are ready
   */
  private static async promoteDelayedJobs(): Promise<void> {
    if (this.config?.driver === "redis" && this.redisClient) {
      const now = Date.now();
      const ready = await this.redisClient.zrangebyscore(
        "mail:delayed",
        0,
        now
      );

      for (const data of ready) {
        const job: SerializedJob = JSON.parse(data);
        await this.redisClient.zrem("mail:delayed", data);
        await this.redisClient.lpush(`mail:queue:${job.priority}`, data);
      }
    } else {
      // Memory queue - check processAt
      const now = new Date();
      for (const priority of ["high", "normal", "low"] as JobPriority[]) {
        this.queues[priority] = this.queues[priority].filter((job) => {
          if (job.processAt && job.processAt > now) {
            // Not ready yet, keep in queue
            return true;
          }
          return true; // Ready to process
        });
      }
    }
  }

  /**
   * Process next job in queue
   */
  private static async processNext(): Promise<boolean> {
    let job: MailJob | null = null;

    // Get job from highest priority queue first
    if (this.config?.driver === "redis" && this.redisClient) {
      for (const priority of ["high", "normal", "low"] as JobPriority[]) {
        const data = await this.redisClient.rpop(`mail:queue:${priority}`);
        if (data) {
          const serialized: SerializedJob = JSON.parse(data);
          job = this.deserializeJob(serialized);
          break;
        }
      }
    } else {
      for (const priority of ["high", "normal", "low"] as JobPriority[]) {
        if (this.queues[priority].length > 0) {
          job = this.queues[priority].shift()!;
          break;
        }
      }
    }

    if (!job) return false;

    // Check if delayed
    if (job.processAt && job.processAt > new Date()) {
      await this.add(job.mailable, {
        priority: job.priority,
        delay: job.processAt.getTime() - Date.now(),
      });
      return false;
    }

    // Check if should retry
    if (job.nextRetry && new Date() < job.nextRetry) {
      await this.add(job.mailable, { priority: job.priority });
      return false;
    }

    // Process job
    this.processingCount++;
    job.status = "processing";
    const startTime = Date.now();

    try {
      const result = await job.mailable.send();
      job.result = result;
      job.status = result.success ? "completed" : "failed";

      if (result.success) {
        this.stats.completed++;
        this.emit("job:completed", { jobId: job.id, result });
      } else {
        await this.handleFailedJob(
          job,
          new Error(result.error?.message || "Send failed")
        );
      }
    } catch (error) {
      await this.handleFailedJob(job, error as Error);
    } finally {
      this.processingCount--;
      const duration = Date.now() - startTime;
      this.stats.totalProcessed++;
      this.stats.totalTime += duration;
    }

    return true;
  }

  /**
   * Deserialize job from storage
   */
  private static deserializeJob(serialized: SerializedJob): MailJob {
    // Create a simple mailable wrapper
    const mailable = new SimpleMailable(serialized.mailableData);

    return {
      id: serialized.id,
      mailable,
      attempts: serialized.attempts,
      maxRetries: serialized.maxRetries,
      priority: serialized.priority,
      status: serialized.status,
      createdAt: new Date(serialized.createdAt),
      processAt: serialized.processAt
        ? new Date(serialized.processAt)
        : undefined,
      nextRetry: serialized.nextRetry
        ? new Date(serialized.nextRetry)
        : undefined,
      lastError: serialized.lastError,
    };
  }

  /**
   * Handle failed job
   */
  private static async handleFailedJob(
    job: MailJob,
    error: Error
  ): Promise<void> {
    job.attempts++;
    job.lastError = error.message;
    job.status = "failed";
    this.stats.failed++;

    this.emit("job:failed", {
      jobId: job.id,
      attempts: job.attempts,
      error: error.message,
    });

    if (job.attempts < job.maxRetries) {
      // Calculate exponential backoff
      const baseDelay = this.config?.retryDelay || 60;
      const delay = baseDelay * Math.pow(2, job.attempts - 1);
      job.nextRetry = new Date(Date.now() + delay * 1000);

      console.warn(
        `Mail job ${job.id} failed (attempt ${job.attempts}/${job.maxRetries}), retrying in ${delay}s`
      );

      await this.add(job.mailable, { priority: job.priority });
    } else {
      console.error(
        `Mail job ${job.id} failed after ${job.maxRetries} attempts:`,
        error
      );
      await this.moveToDeadLetter(job, error);
    }
  }

  /**
   * Move job to dead letter queue
   */
  private static async moveToDeadLetter(
    job: MailJob,
    error: Error
  ): Promise<void> {
    job.status = "dead";
    this.stats.dead++;

    const deadJob = {
      ...this.serializeJob(job),
      error: error.message,
      failedAt: new Date().toISOString(),
    };

    this.emit("job:dead", { jobId: job.id, error: error.message });

    if (this.config?.driver === "redis" && this.redisClient) {
      await this.redisClient.lpush("mail:dead", JSON.stringify(deadJob));
      // Trim dead letter queue to prevent unbounded growth
      await this.redisClient.ltrim("mail:dead", 0, 999);
    } else {
      console.error("Dead letter mail job:", deadJob);
    }
  }

  /**
   * Generate unique job ID
   */
  private static generateId(): string {
    return `mail_${Date.now().toString(36)}_${crypto
      .randomBytes(6)
      .toString("hex")}`;
  }

  /**
   * Get queue size
   */
  static async size(priority?: JobPriority): Promise<number> {
    if (this.config?.driver === "redis" && this.redisClient) {
      if (priority) {
        return await this.redisClient.llen(`mail:queue:${priority}`);
      }
      const [high, normal, low] = await Promise.all([
        this.redisClient.llen("mail:queue:high"),
        this.redisClient.llen("mail:queue:normal"),
        this.redisClient.llen("mail:queue:low"),
      ]);
      return high + normal + low;
    }

    if (priority) {
      return this.queues[priority].length;
    }
    return (
      this.queues.high.length +
      this.queues.normal.length +
      this.queues.low.length
    );
  }

  /**
   * Get dead letter queue size
   */
  static async deadLetterSize(): Promise<number> {
    if (this.config?.driver === "redis" && this.redisClient) {
      return await this.redisClient.llen("mail:dead");
    }
    return 0;
  }

  /**
   * Get queue statistics
   */
  static async getStats(): Promise<QueueStats> {
    const [pending, deadCount] = await Promise.all([
      this.size(),
      this.deadLetterSize(),
    ]);

    return {
      pending,
      processing: this.processingCount,
      completed: this.stats.completed,
      failed: this.stats.failed,
      dead: deadCount,
      totalProcessed: this.stats.totalProcessed,
      avgProcessingTime:
        this.stats.totalProcessed > 0
          ? this.stats.totalTime / this.stats.totalProcessed
          : 0,
    };
  }

  /**
   * Retry dead letter jobs
   */
  static async retryDeadLetter(count?: number): Promise<number> {
    if (this.config?.driver !== "redis" || !this.redisClient) {
      return 0;
    }

    const toRetry = count || 10;
    let retried = 0;

    for (let i = 0; i < toRetry; i++) {
      const data = await this.redisClient.rpop("mail:dead");
      if (!data) break;

      const job: SerializedJob = JSON.parse(data);
      job.attempts = 0;
      job.status = "pending";
      await this.redisClient.lpush(
        `mail:queue:${job.priority}`,
        JSON.stringify(job)
      );
      retried++;
    }

    return retried;
  }

  /**
   * Pause queue processing
   */
  static pause(): void {
    this.processing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  /**
   * Resume queue processing
   */
  static resume(): void {
    if (!this.processing && !this.shuttingDown) {
      this.startProcessing();
    }
  }

  /**
   * Clear the queue
   */
  static async clear(priority?: JobPriority): Promise<void> {
    if (this.config?.driver === "redis" && this.redisClient) {
      if (priority) {
        await this.redisClient.del(`mail:queue:${priority}`);
      } else {
        await Promise.all([
          this.redisClient.del("mail:queue:high"),
          this.redisClient.del("mail:queue:normal"),
          this.redisClient.del("mail:queue:low"),
          this.redisClient.del("mail:delayed"),
        ]);
      }
    } else {
      if (priority) {
        this.queues[priority] = [];
      } else {
        this.queues = { high: [], normal: [], low: [] };
      }
    }
  }

  /**
   * Clear dead letter queue
   */
  static async clearDeadLetter(): Promise<void> {
    if (this.config?.driver === "redis" && this.redisClient) {
      await this.redisClient.del("mail:dead");
    }
  }

  /**
   * Register event handler
   */
  static on(event: QueueEventType, handler: QueueEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Remove event handler
   */
  static off(event: QueueEventType, handler: QueueEventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Emit event
   */
  private static emit(event: QueueEventType, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in queue event handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Graceful shutdown
   */
  static async shutdown(): Promise<void> {
    this.shuttingDown = true;
    this.pause();

    // Wait for in-flight jobs to complete
    const maxWait = 30000;
    const startWait = Date.now();

    while (this.processingCount > 0 && Date.now() - startWait < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (this.processingCount > 0) {
      console.warn(
        `Shutdown with ${this.processingCount} jobs still processing`
      );
    }

    // Close Redis connection
    if (this.redisClient) {
      await this.redisClient.quit();
      this.redisClient = undefined;
    }
  }
}

/**
 * Simple mailable wrapper for deserialized jobs
 */
class SimpleMailable extends Mailable {
  constructor(private data: Record<string, any>) {
    super();
    this.message = data.message || {};
    this.viewName = data.viewName;
    this.viewData = data.viewData;
  }

  build(): this {
    return this;
  }
}
