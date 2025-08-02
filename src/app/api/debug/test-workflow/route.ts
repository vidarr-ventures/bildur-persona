import { NextRequest, NextResponse } from 'next/server';
import { createResearchRequest, updateJobStatus } from '@/lib/db';
import { Queue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const { email = 'test@example.com', skipProcessing = false } = await request.json();
    
    // Create a test job
    const jobId = `test_job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🧪 Creating test job: ${jobId}`);
    
    // Create research request
    const researchRequest = await createResearchRequest({
      jobId,
      websiteUrl: 'https://example.com',
      amazonUrl: 'https://amazon.com/dp/test',
      keywords: 'test keywords',
      email,
      competitorUrls: ['https://competitor1.com', 'https://competitor2.com'],
      planId: 'comprehensive',
      planName: 'Comprehensive Analysis',
      discountCode: 'TEST',
      paymentSessionId: 'test_session_123',
      amountPaid: 0,
      originalPrice: 9900,
      finalPrice: 0,
      isFree: true
    });

    console.log(`✅ Test research request created: ${researchRequest.id}`);

    if (!skipProcessing) {
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

      // Also trigger direct processing
      setTimeout(async () => {
        try {
          console.log(`🔄 Triggering direct processing for test job: ${jobId}`);
          await Queue.executeWorkersDirectly({
            jobId,
            websiteUrl: 'https://example.com',
            targetKeywords: 'test keywords',
            amazonUrl: 'https://amazon.com/dp/test'
          });
        } catch (error) {
          console.error(`❌ Test job processing failed:`, error);
        }
      }, 2000);
    }

    return NextResponse.json({
      success: true,
      testJob: {
        jobId,
        email,
        researchRequestId: researchRequest.id,
        dashboardUrl: `/dashboard/${jobId}`,
        debugUrl: `/api/debug/job-status?jobId=${jobId}`,
        statusCheckUrl: `/api/jobs/${jobId}/persona`,
        queueProcessing: !skipProcessing
      },
      message: `Test job ${jobId} created successfully`,
      nextSteps: [
        '1. Check job status at the debug URL',
        '2. Monitor queue processing',
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
