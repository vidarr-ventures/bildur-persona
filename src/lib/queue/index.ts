import { kv } from '@vercel/kv';

export class JobQueue {
  async addJob(jobId: string, taskType: string, payload: any) {
    const task = {
      jobId,
      payload,
      attempts: 0,
      createdAt: Date.now()
    };

    await kv.lpush(`queue:${taskType}`, JSON.stringify(task));
    
    // Add to the job's task list for tracking
    await kv.sadd(`job:${jobId}:tasks`, taskType);
    
    console.log(`Added ${taskType} task for job ${jobId}`);
  }

  async getJob(taskType: string) {
    const item = await kv.rpop(`queue:${taskType}`);
    if (item) {
      return JSON.parse(item);
    }
    return null;
  }

  async markTaskCompleted(jobId: string, taskType: string) {
    await kv.srem(`job:${jobId}:tasks`, taskType);
    console.log(`Completed ${taskType} task for job ${jobId}`);
  }

  async getJobProgress(jobId: string) {
    const remainingTasks = await kv.scard(`job:${jobId}:tasks`);
    return remainingTasks;
  }
}
