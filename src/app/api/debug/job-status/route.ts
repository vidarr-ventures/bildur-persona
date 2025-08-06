import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

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

    // Queue system has been removed
    const queueStats = { pending: 0, processing: 0, note: 'Queue system removed' };

    // Queue system has been removed - no queue checks needed
    const inProcessingQueue = false;
    const inPendingQueue = false;

    // Queue system has been removed - no queue checking needed

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
        // Queue system removed - cannot retry through queue
        return NextResponse.json({ 
          success: false, 
          message: `Queue system has been removed. Job retry not available.` 
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
        // Queue system removed - no queue to clear from
        return NextResponse.json({ 
          success: true, 
          message: `Queue system has been removed. No queue to clear from.` 
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