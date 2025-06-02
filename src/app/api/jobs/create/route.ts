import { NextRequest, NextResponse } from 'next/server';
import { createJob, initializeDatabase } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    // Initialize database tables if they don't exist
    await initializeDatabase();

    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    const { primaryProductUrl, amazonProductUrl, targetKeywords } = body;
    
    if (!primaryProductUrl || !amazonProductUrl || !targetKeywords) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create job in database
    const jobId = await createJob(body);
    
    console.log('Job created:', jobId);
// Queue a test worker
const queue = new JobQueue();
await queue.addJob(jobId, 'test-worker', { 
  primaryProductUrl,
  amazonProductUrl,
  targetKeywords 
});

// Trigger the worker
await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/workers/test-worker`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId, payload: { primaryProductUrl, amazonProductUrl, targetKeywords } })
});
    // Return job ID for tracking
    return NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Job created successfully'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    );
  }
}
