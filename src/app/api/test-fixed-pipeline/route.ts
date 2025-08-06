import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';
import { processJobWithWorkersSequential } from '@/lib/job-processor';

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing FIXED job processing pipeline...');
    
    // Create a test job
    const job = await createJob({
      website_url: 'https://example.com',
      target_keywords: 'test product',
      amazon_url: 'https://amazon.com/test',
      status: 'pending'
    });

    console.log(`✅ Test job created: ${job.id}`);

    // Process using the FIXED worker system (fire and forget - async)
    processJobWithWorkersSequential(
      job.id, 
      'https://example.com', 
      'test product', 
      'https://amazon.com/test', 
      ['https://competitor1.com', 'https://competitor2.com']
    ).catch(error => {
      console.error('❌ Worker processing error:', error);
    });

    return NextResponse.json({
      success: true,
      message: 'FIXED pipeline test started successfully',
      jobId: job.id,
      note: 'Job is processing in the background. Check the debug panel for real-time status.'
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