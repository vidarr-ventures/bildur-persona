import { kv } from '@vercel/kv';
import { updateJobStatus } from '@/lib/db';

export interface QueueJob {
  id: string;
  type: 'persona_research';
  data: {
    jobId: string;
    websiteUrl: string;
    targetKeywords: string;
    amazonUrl?: string;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  attempts: number;
  maxAttempts: number;
  nextRetry?: number;
}

export class Queue {
  private static readonly QUEUE_KEY = 'job_queue';
  private static readonly PROCESSING_KEY = 'processing_jobs';
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly RETRY_DELAY = 30000; // 30 seconds

  static async addJob(jobData: Omit<QueueJob, 'id' | 'status' | 'createdAt' | 'attempts' | 'maxAttempts'>): Promise<string> {
    const job: QueueJob = {
      ...jobData,
      id: `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      createdAt: Date.now(),
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
    };

    // Add to queue using lpush (left push)
    await kv.lpush(this.QUEUE_KEY, JSON.stringify(job));
    
    // Trigger processing immediately
    await this.triggerProcessing();
    
    return job.id;
  }

  static async getNextJob(): Promise<QueueJob | null> {
    try {
      // Get job from queue using rpop (right pop) for FIFO behavior
      const jobStr = await kv.rpop(this.QUEUE_KEY);
      if (!jobStr) return null;

      const job: QueueJob = JSON.parse(jobStr);
      
      // Mark as processing
      job.status = 'processing';
      await kv.hset(this.PROCESSING_KEY, { [job.id]: JSON.stringify(job) });
      
      return job;
    } catch (error) {
      console.error('Error getting next job:', error);
      return null;
    }
  }

  static async completeJob(jobId: string): Promise<void> {
    try {
      await kv.hdel(this.PROCESSING_KEY, jobId);
      console.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      console.error('Error completing job:', error);
    }
  }

  static async failJob(jobId: string, error: string): Promise<void> {
    try {
      const jobStr = await kv.hget(this.PROCESSING_KEY, jobId);
      if (!jobStr || typeof jobStr !== 'string') return;

      const job: QueueJob = JSON.parse(jobStr);
      job.attempts++;

      if (job.attempts < job.maxAttempts) {
        // Retry job
        job.status = 'pending';
        job.nextRetry = Date.now() + this.RETRY_DELAY;
        await kv.lpush(this.QUEUE_KEY, JSON.stringify(job));
        console.log(`Job ${jobId} failed, retrying (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        // Max attempts reached
        job.status = 'failed';
        console.log(`Job ${jobId} failed permanently after ${job.maxAttempts} attempts`);
      }

      await kv.hdel(this.PROCESSING_KEY, jobId);
    } catch (error) {
      console.error('Error failing job:', error);
    }
  }

  static async getQueueStats(): Promise<{
    pending: number;
    processing: number;
  }> {
    try {
      const pendingCount = await kv.llen(this.QUEUE_KEY);
      const processingJobs = await kv.hgetall(this.PROCESSING_KEY);
      const processingCount = processingJobs ? Object.keys(processingJobs).length : 0;

      return {
        pending: pendingCount || 0,
        processing: processingCount,
      };
    } catch (error) {
      console.error('Error getting queue stats:', error);
      return { pending: 0, processing: 0 };
    }
  }

  static async triggerProcessing(): Promise<void> {
    try {
      // Get base URL for the current environment
      const baseUrl = process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : process.env.NEXTAUTH_URL || 'http://localhost:3000';
      
      console.log('Triggering queue processor at:', baseUrl);
      
      // Call the queue processor endpoint immediately
      const response = await fetch(`${baseUrl}/api/queue/processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trigger: true }),
      });

      if (!response.ok) {
        console.error('Queue processor trigger failed:', response.status, response.statusText);
        // Try direct processing as fallback
        await this.processQueueDirectly();
      } else {
        console.log('Queue processor triggered successfully');
      }
    } catch (error) {
      console.error('Error triggering queue processor:', error);
      
      // Fallback: try direct processing
      try {
        console.log('Trying fallback direct processing...');
        await this.processQueueDirectly();
      } catch (fallbackError) {
        console.error('Fallback processing also failed:', fallbackError);
      }
    }
  }

  static async processQueueDirectly(): Promise<void> {
    try {
      console.log('Direct queue processing started...');
      
      // Get next job
      const job = await this.getNextJob();
      if (!job) {
        console.log('No jobs in queue for direct processing');
        return;
      }

      console.log('Processing job directly:', job.id);
      
      // Update job status
      await updateJobStatus(job.data.jobId, 'processing');
      
      // Execute workers directly
      await this.executeWorkersDirectly(job.data);
      
      // Mark as completed
      await updateJobStatus(job.data.jobId, 'completed');
      await this.completeJob(job.id);
      
      console.log('Direct processing completed for job:', job.id);
      
    } catch (error) {
      console.error('Direct queue processing error:', error);
    }
  }

  static async executeWorkersDirectly(jobData: any): Promise<void> {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXTAUTH_URL || 'http://localhost:3000';

    // Import here to avoid circular dependencies
    const { getResearchRequest } = await import('@/lib/db');

    // Get research request data for email info
    const researchRequest = await getResearchRequest(jobData.jobId);

    const workers = [
      '/api/workers/website-crawler',
      '/api/workers/reviews-collector', 
      '/api/workers/amazon-competitors',
      '/api/workers/persona-generator'
    ];

    for (const worker of workers) {
      try {
        console.log('Executing worker:', worker);
        
        // For persona generator, include email and plan info
        const workerPayload = {
          jobId: jobData.jobId,
          websiteUrl: jobData.websiteUrl,
          targetKeywords: jobData.targetKeywords,
          amazonUrl: jobData.amazonUrl,
          ...(worker.includes('persona-generator') && researchRequest ? {
            email: researchRequest.email,
            planName: researchRequest.plan_name
          } : {})
        };
        
        const response = await fetch(`${baseUrl}${worker}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workerPayload),
        });

        if (!response.ok) {
          console.error(`Worker ${worker} failed:`, response.status, await response.text());
        } else {
          console.log(`Worker ${worker} completed successfully`);
          const result = await response.json();
          console.log(`Worker ${worker} result:`, result);
        }
      } catch (error) {
        console.error(`Error executing worker ${worker}:`, error);
      }
    }
  }

  static async processRetryableJobs(): Promise<void> {
    try {
      // Get all processing jobs and check for stuck ones
      const processingJobs = await kv.hgetall(this.PROCESSING_KEY);
      if (!processingJobs) return;

      const now = Date.now();
      const stuckJobTimeout = 10 * 60 * 1000; // 10 minutes

      for (const [jobId, jobStr] of Object.entries(processingJobs)) {
        if (typeof jobStr !== 'string') continue;
        
        try {
          const job: QueueJob = JSON.parse(jobStr);
          
          // If job has been processing too long, consider it stuck
          if (now - job.createdAt > stuckJobTimeout) {
            console.log(`Detected stuck job ${jobId}, retrying...`);
            await this.failJob(jobId, 'Job timeout - stuck in processing');
          }
        } catch (parseError) {
          console.error(`Error parsing job ${jobId}:`, parseError);
          await kv.hdel(this.PROCESSING_KEY, jobId);
        }
      }
    } catch (error) {
      console.error('Error processing retryable jobs:', error);
    }
  }
}
