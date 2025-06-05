import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';
import { Queue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract fields that the form actually sends
    const { primaryProductUrl, targetKeywords, amazonProductUrl } = body;
    
    // Map to expected variable names
    const websiteUrl = primaryProductUrl;
    const amazonUrl = amazonProductUrl;
    
    console.log('Received form data:', { primaryProductUrl, targetKeywords, amazonProductUrl });
    console.log('Mapped to:', { websiteUrl, targetKeywords, amazonUrl });
    
    if (!websiteUrl || !targetKeywords) {
      return NextResponse.json(
        { 
          error: 'Website URL and target keywords are required',
          received: { websiteUrl, targetKeywords, amazonUrl }
        },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid website URL format' },
        { status: 400 }
      );
    }

    // Validate Amazon URL if provided
    if (amazonUrl) {
      try {
        new URL(amazonUrl);
      } catch {
        return NextResponse.json(
          { error: 'Invalid Amazon URL format' },
          { status: 400 }
        );
      }
    }

    // Create job in database
    console.log('Creating job with data:', { websiteUrl, targetKeywords, amazonUrl });
    
    let job;
    try {
      job = await createJob({
        website_url: websiteUrl,
        target_keywords: targetKeywords,
        amazon_url: amazonUrl || null,
        status: 'pending'
      });
      console.log('Job created in database:', job);
    } catch (dbError) {
      console.error('Database error creating job:', dbError);
      const dbErrorMessage = dbError instanceof Error ? dbError.message : 'Database error';
      return NextResponse.json(
        { 
          error: 'Database error creating job',
          details: dbErrorMessage,
          step: 'database_creation'
        },
        { status: 500 }
      );
    }

    // Add job to queue for automatic processing
    let queueJobId;
    try {
      queueJobId = await Queue.addJob({
        type: 'persona_research',
        data: {
          jobId: job.id,
          websiteUrl: websiteUrl,
          targetKeywords: targetKeywords,
          amazonUrl: amazonUrl,
        },
      });
      console.log('Job added to queue:', queueJobId);
    } catch (queueError) {
      console.error('Queue error:', queueError);
      const queueErrorMessage = queueError instanceof Error ? queueError.message : 'Queue error';
      return NextResponse.json(
        { 
          error: 'Queue error adding job',
          details: queueErrorMessage,
          step: 'queue_addition',
          jobId: job.id
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      jobId: job.id,
      queueId: queueJobId,
      message: 'Job created and queued for processing'
    });

  } catch (error) {
    console.error('General job creation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Type-safe error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to create job', 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
        step: 'general_error'
      },
      { status: 500 }
    );
  }
}
