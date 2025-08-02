import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';
import { Queue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const { email = 'test@example.com', skipProcessing = true } = await request.json();
    
    // Create a basic job instead of research request for testing
    const job = await createJob({
      website_url: 'https://example.com',
      target_keywords: 'test keywords',
      amazon_url: 'https://amazon.com/dp/test',
      status: 'pending'
    });

    const jobId = job.id;
    console.log(`🧪 Creating test job: ${jobId}`);
    console.log(`✅ Test job created: ${job.id}`);

    // Only do queue processing if explicitly requested (skip by default to avoid fetch errors)
    if (!skipProcessing) {
      try {
        // Add to queue for processing
        const queueJobId = await Queue.addJob({
          type: 'persona_research',
          data: {
            jobId,
            websiteUrl: 'https://example.com',
            targetKeywords: 'test keywords',
            amazonUrl: 'https://amazon.com/dp/test'
          }
        });

        console.log(`📤 Test job added to queue: ${queueJobId}`);
      } catch (queueError) {
        console.warn('Queue processing failed, but job creation succeeded:', queueError);
      }
    }

    return NextResponse.json({
      success: true,
      testJob: {
        jobId,
        email,
        researchRequestId: job.id,
        dashboardUrl: `/dashboard/${jobId}`,
        debugUrl: `/api/debug/job-status?jobId=${jobId}`,
        statusCheckUrl: `/api/jobs/${jobId}/persona`,
        queueProcessing: !skipProcessing
      },
      message: `Test job ${jobId} created successfully`,
      nextSteps: [
        '1. Check job status at the debug URL',
        '2. Monitor queue processing (skipped by default)',
        '3. Verify persona generation',
        '4. Test email delivery (if enabled)',
        '5. Check results display on success page'
      ]
    });

  } catch (error) {
    console.error('Test workflow error:', error);
    return NextResponse.json({
      error: 'Failed to create test workflow',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test Workflow Endpoint',
    usage: {
      method: 'POST',
      body: {
        email: 'test@example.com (optional)',
        skipProcessing: 'false (optional - set to true to only create job without processing)'
      }
    },
    endpoints: {
      systemStatus: '/api/debug/system-status',
      jobStatus: '/api/debug/job-status?jobId=JOB_ID',
      queueStatus: '/api/queue/status'
    }
  });
}
