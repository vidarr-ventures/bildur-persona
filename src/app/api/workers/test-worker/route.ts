import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;
    
    console.log(`Processing test worker for job ${jobId}`);
    
    // Update job status to processing
    await updateJobStatus(jobId, 'processing', 25);
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 50);
    
    // Simulate more work
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mark as completed
    await updateJobStatus(jobId, 'completed', 100);
    
    const queue = new JobQueue();
    await queue.markTaskCompleted(jobId, 'test-worker');
    
    console.log(`Completed test worker for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Test worker completed'
    });

  } catch (error) {
    console.error('Test worker error:', error);
    return NextResponse.json(
      { error: 'Test worker failed' },
      { status: 500 }
    );
  }
}
