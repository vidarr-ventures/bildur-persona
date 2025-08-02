import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { email = 'test@example.com' } = await request.json();
    
    console.log('🧪 Creating simple test job...');
    
    // Create a basic job - this should work
    const job = await createJob({
      website_url: 'https://example.com',
      target_keywords: 'test keywords',
      amazon_url: 'https://amazon.com/dp/test',
      status: 'pending'
    });

    console.log(`✅ Simple test job created: ${job.id}`);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      email,
      testType: 'simple',
      debugUrl: `/api/debug/job-status?jobId=${job.id}`,
      message: `Simple test job ${job.id} created successfully - skips research_requests table`
    });

  } catch (error) {
    console.error('Simple test error:', error);
    return NextResponse.json({
      error: 'Failed to create simple test',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}