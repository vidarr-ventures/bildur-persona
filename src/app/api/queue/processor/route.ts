import { NextRequest, NextResponse } from 'next/server';
import { Queue } from '@/lib/queue';
import { updateJobStatus, getJobById, getResearchRequest } from '@/lib/db';

// Worker execution function
async function executeWorkers(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  const baseUrl = process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}` 
    : process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const workers = [
    { name: 'website-crawler', endpoint: '/api/workers/website-crawler' },
    { name: 'amazon-reviews', endpoint: '/api/workers/amazon-reviews' },
    { name: 'reddit-scraper', endpoint: '/api/workers/reddit-scraper' },
    { name: 'youtube-comments', endpoint: '/api/workers/youtube-comments' },
  ];

  // Execute data collection workers in parallel
  const workerPromises = workers.map(async (worker) => {
    try {
      console.log(`Starting ${worker.name} for job ${jobId}`);
      
      const response = await fetch(`${baseUrl}${worker.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobId,
          websiteUrl,
          targetKeywords,
          amazonUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`${worker.name} failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`${worker.name} completed for job ${jobId}`);
      return { worker: worker.name, success: true, result };
    } catch (error) {
      console.error(`${worker.name} failed for job ${jobId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { worker: worker.name, success: false, error: errorMessage };
    }
  });

  // Wait for all data collection workers to complete
  const workerResults = await Promise.all(workerPromises);
  
  // Check if any critical workers failed
  const failedWorkers = workerResults.filter(r => !r.success);
  if (failedWorkers.length > 0) {
    console.log(`Some workers failed for job ${jobId}:`, failedWorkers);
  }

  // Always attempt persona generation, even if some data collection failed
  try {
    console.log(`Starting persona generation for job ${jobId}`);
    
    // Get research request data for email and plan info
    const researchRequest = await getResearchRequest(jobId);
    
    const personaResponse = await fetch(`${baseUrl}/api/workers/persona-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId,
        websiteUrl,
        targetKeywords,
        amazonUrl,
        email: researchRequest?.email,
        planName: researchRequest?.plan_name,
      }),
    });

    if (!personaResponse.ok) {
      throw new Error(`Persona generation failed: ${personaResponse.statusText}`);
    }

    const personaResult = await personaResponse.json();
    console.log(`Persona generation completed for job ${jobId}`);
    
    return {
      success: true,
      workerResults,
      personaResult,
    };
  } catch (error) {
    console.error(`Persona generation failed for job ${jobId}:`, error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // If this is just a trigger, start processing and return immediately
    if (body.trigger) {
      // Don't wait for processing to complete
      processQueueAsync();
      return NextResponse.json({ message: 'Queue processing triggered' });
    }

    // Manual processing request
    if (body.jobId) {
      const job = await getJobById(body.jobId);
      if (!job) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }

      await updateJobStatus(body.jobId, 'processing');
      
      const result = await executeWorkers(
        body.jobId,
        job.website_url,
        job.target_keywords,
        job.amazon_url
      );

      await updateJobStatus(body.jobId, 'completed');
      
      return NextResponse.json({
        message: 'Job processed successfully',
        result,
      });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Queue processor error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Queue processing failed', details: errorMessage },
      { status: 500 }
    );
  }
}

// Async function to process queue without blocking the response
async function processQueueAsync() {
  try {
    console.log('Starting queue processing...');
    
    // Process retry jobs first
    await Queue.processRetryableJobs();
    
    // Process pending jobs
    let processedCount = 0;
    const maxJobs = 5; // Limit concurrent jobs
    
    while (processedCount < maxJobs) {
      const job = await Queue.getNextJob();
      if (!job) {
        console.log('No more jobs in queue');
        break;
      }

      try {
        console.log(`Processing job ${job.id}`);
        
        // Update database status
        await updateJobStatus(job.data.jobId, 'processing');
        
        // Execute workers
        const result = await executeWorkers(
          job.data.jobId,
          job.data.websiteUrl,
          job.data.targetKeywords,
          job.data.amazonUrl
        );

        // Mark job as completed
        await updateJobStatus(job.data.jobId, 'completed');
        await Queue.completeJob(job.id);
        
        console.log(`Job ${job.id} completed successfully`);
        processedCount++;
        
      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await updateJobStatus(job.data.jobId, 'failed');
        await Queue.failJob(job.id, errorMessage);
      }
    }
    
    console.log(`Queue processing completed. Processed ${processedCount} jobs.`);
    
    // Check if there are more jobs and schedule next processing
    const stats = await Queue.getQueueStats();
    if (stats.pending > 0) {
      console.log(`${stats.pending} jobs still pending, scheduling next processing...`);
      // Schedule next processing in 30 seconds
      setTimeout(() => {
        processQueueAsync();
      }, 30000);
    }
    
  } catch (error) {
    console.error('Queue processing error:', error);
  }
}

export async function GET() {
  try {
    const stats = await Queue.getQueueStats();
    return NextResponse.json({
      message: 'Queue processor status',
      stats,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}
