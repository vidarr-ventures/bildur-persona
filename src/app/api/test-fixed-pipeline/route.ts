import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing simplified job processing pipeline...');
    
    // Create a test job
    const job = await createJob({
      website_url: 'https://example.com',
      target_keywords: 'test product',
      amazon_url: 'https://amazon.com/test',
      status: 'processing'
    });

    console.log(`✅ Test job created: ${job.id}`);

    // TODO: Implement direct processing here
    // For now, just mark as completed
    await updateJobStatus(job.id, 'completed');

    return NextResponse.json({
      success: true,
      message: 'Simplified pipeline test completed',
      jobId: job.id,
      note: 'Worker/queue system has been removed. Direct processing will be implemented next.'
    });

  } catch (error) {
    console.error('❌ Pipeline test failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Pipeline test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}