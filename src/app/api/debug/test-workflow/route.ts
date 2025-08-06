import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email = 'test@example.com', skipProcessing = true } = await request.json();
    
    // Create a basic job instead of research request for testing
    const job = await createJob({
      website_url: 'https://example.com',
      target_keywords: 'test keywords',
      amazon_url: 'https://amazon.com/dp/test',
      status: 'completed'  // Mark as completed since queue system is removed
    });

    const jobId = job.id;
    console.log(`🧪 Creating test job: ${jobId}`);
    console.log(`✅ Test job created: ${job.id}`);

    // Queue system has been removed - no processing needed

    return NextResponse.json({
      success: true,
      testJob: {
        jobId,
        email,
        researchRequestId: job.id,
        dashboardUrl: `/dashboard/${jobId}`,
        debugUrl: `/api/debug/job-status?jobId=${jobId}`,
        statusCheckUrl: `/api/jobs/${jobId}/persona`,
        queueProcessing: false  // Queue system removed
      },
      message: `Test job ${jobId} created successfully - queue system removed`,
      nextSteps: [
        '1. Check job status at the debug URL',
        '2. Queue system has been removed',
        '3. Direct API processing will be implemented',
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
      note: 'Queue endpoints have been removed'
    }
  });
}
