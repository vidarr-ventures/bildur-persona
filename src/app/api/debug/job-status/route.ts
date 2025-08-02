import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { Queue } from '@/lib/queue';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    console.log(`🔍 Debugging job status for: ${jobId}`);

    // Get job from jobs table
    const jobResult = await sql`SELECT * FROM jobs WHERE id = ${jobId}`;
    const job = jobResult.rows[0];

    // Get research request
    const researchResult = await sql`SELECT * FROM research_requests WHERE job_id = ${jobId}`;
    const researchRequest = researchResult.rows[0];

    // Get queue stats
    const queueStats = await Queue.getQueueStats();

    // Check if job is in processing queue using Vercel KV
    let inProcessingQueue = false;
    let inPendingQueue = false;
    
    try {
      const { kv } = await import('@vercel/kv');
      
      // Check processing queue
      const processingJobs = await kv.hgetall('processing_jobs');
      if (processingJobs) {
        for (const [queueJobId, jobDataStr] of Object.entries(processingJobs)) {
          if (typeof jobDataStr === 'string') {
            try {
              const queueJob = JSON.parse(jobDataStr);
              if (queueJob.data?.jobId === jobId) {
                inProcessingQueue = true;
                break;
              }
            } catch (e) {
              console.error('Error parsing processing job:', e);
            }
          }
        }
      }

      // Check pending queue
      const pendingJobs = await kv.lrange('job_queue', 0, -1);
      if (pendingJobs && Array.isArray(pendingJobs)) {
        for (const jobDataStr of pendingJobs) {
          if (typeof jobDataStr === 'string') {
            try {
              const queueJob = JSON.parse(jobDataStr);
              if (queueJob.data?.jobId === jobId) {
                inPendingQueue = true;
                break;
              }
            } catch (e) {
              console.error('Error parsing pending job:', e);
            }
          }
        }
      }
    } catch (kvError) {
      console.error('Error checking KV queues:', kvError);
    }

    return NextResponse.json({
      jobId,
      debug: {
        foundInJobsTable: !!job,
        foundInResearchRequests: !!researchRequest,
        inProcessingQueue,
        inPendingQueue,
        queueStats,
        lastActivity: new Date().toISOString()
      },
      job: job ? {
        id: job.id,
        status: job.status,
        progress: job.progress,
        created_at: job.created_at,
        completed_at: job.completed_at,
        error_message: job.error_message
      } : null,
      researchRequest: researchRequest ? {
        id: researchRequest.id,
        job_id: researchRequest.job_id,
        status: researchRequest.status,
        email: researchRequest.email,
        created_at: researchRequest.created_at,
        completed_at: researchRequest.completed_at,
        persona_report_sent: researchRequest.persona_report_sent,
        has_persona_analysis: !!researchRequest.persona_analysis
      } : null
    });

  } catch (error) {
    console.error('Job status debug error:', error);
    return NextResponse.json({
      error: 'Failed to get job status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, action } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    console.log(`🔧 Debug action "${action}" for job: ${jobId}`);

    switch (action) {
      case 'retry_processing':
        // Add job back to queue
        const researchResult = await sql`SELECT * FROM research_requests WHERE job_id = ${jobId}`;
        const researchRequest = researchResult.rows[0];
        
        if (!researchRequest) {
          return NextResponse.json({ error: 'Research request not found' }, { status: 404 });
        }

        await Queue.addJob({
          type: 'persona_research',
          data: {
            jobId,
            websiteUrl: researchRequest.website_url,
            targetKeywords: researchRequest.keywords,
            amazonUrl: researchRequest.amazon_url
          }
        });

        return NextResponse.json({ 
          success: true, 
          message: `Job ${jobId} added back to queue for retry` 
        });

      case 'force_complete':
        // Mark as completed (for testing)
        await sql`UPDATE jobs SET status = 'completed', completed_at = NOW() WHERE id = ${jobId}`;
        await sql`UPDATE research_requests SET status = 'completed', completed_at = NOW() WHERE job_id = ${jobId}`;
        
        return NextResponse.json({ 
          success: true, 
          message: `Job ${jobId} marked as completed` 
        });

      case 'clear_from_queue':
        // Remove from processing queue if stuck
        try {
          await Queue.completeJob(jobId);
        } catch (e) {
          console.log('Job not in queue or already removed');
        }
        
        return NextResponse.json({ 
          success: true, 
          message: `Job ${jobId} cleared from processing queue` 
        });

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Job debug action error:', error);
    return NextResponse.json({
      error: 'Failed to execute debug action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}