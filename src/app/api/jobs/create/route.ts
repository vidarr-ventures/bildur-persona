import { NextRequest, NextResponse } from 'next/server';
import { createJob, initializeDatabase } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    console.log('Starting job creation...');

    // Parse request body
    let body;
    try {
      body = await request.json();
      console.log('Request body parsed successfully:', body);
    } catch (parseError) {
      console.error('Failed to parse request body:', parseError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    // Validate required fields
    const { primaryProductUrl, amazonProductUrl, targetKeywords } = body;
    
    if (!primaryProductUrl || !amazonProductUrl || !targetKeywords) {
      console.log('Missing required fields:', { primaryProductUrl, amazonProductUrl, targetKeywords });
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('Validation passed, initializing database...');

    // Initialize database tables if they don't exist
    try {
      await initializeDatabase();
      console.log('Database initialized successfully');
    } catch (dbError: any) {
      console.error('Database initialization failed:', dbError);
      return NextResponse.json(
        { error: 'Database initialization failed', details: dbError?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    console.log('Creating job in database...');

    // Create job in database
    let jobId;
    try {
      jobId = await createJob(body);
      console.log('Job created successfully:', jobId);
      
      // Queue Amazon competitor discovery
      const queue = new JobQueue();
      await queue.addJob(jobId, 'amazon-competitors', { 
        amazonProductUrl,
        targetKeywords 
      });
      
      // Trigger the worker
      const baseUrl = request.nextUrl.origin;
      await fetch(`${baseUrl}/api/workers/amazon-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          jobId, 
          payload: { amazonProductUrl, targetKeywords } 
        })
      });
      
    } catch (createError: any) {
      console.error('Job creation failed:', createError);
      return NextResponse.json(
        { error: 'Failed to create job in database', details: createError?.message || 'Unknown error' },
        { status: 500 }
      );
    }

    // Return job ID for tracking
    return NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: 'Job created successfully'
    });

  } catch (error: any) {
    console.error('Unexpected error in job creation:', error);
    return NextResponse.json(
      { error: 'Failed to create job', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
