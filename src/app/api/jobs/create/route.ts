import { NextRequest, NextResponse } from 'next/server';
import { createJob, initializeDatabase } from '@/lib/db';

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
