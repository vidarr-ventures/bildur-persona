import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';

// Execute all workers for a job
async function processJobAutomatically(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`Starting automatic processing for job ${jobId}`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    const workers = [
      '/api/workers/website-crawler',
      '/api/workers/reviews-collector', 
      '/api/workers/amazon-competitors',
      '/api/workers/persona-generator'
    ];

    // Execute workers sequentially
    for (const worker of workers) {
      try {
        console.log(`Executing ${worker} for job ${jobId}`);
        
        const response = await fetch(`${baseUrl}${worker}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            websiteUrl,
            targetKeywords,
            amazonUrl,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Worker ${worker} failed:`, response.status, errorText);
          throw new Error(`Worker ${worker} failed: ${response.status}`);
        }

        const result = await response.json();
        console.log(`Worker ${worker} completed successfully for job ${jobId}`);
        
      } catch (workerError) {
        console.error(`Error in worker ${worker}:`, workerError);
        // Continue with other workers even if one fails
      }
    }

    // Mark job as completed
    await updateJobStatus(jobId, 'completed');
    console.log(`Job ${jobId} processing completed successfully`);
    
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract fields that the form sends
    const { primaryProductUrl, targetKeywords, amazonProductUrl } = body;
    
    // Map to expected variable names
    const websiteUrl = primaryProductUrl;
    const amazonUrl = amazonProductUrl;
    
    console.log('Received form data:', { primaryProductUrl, targetKeywords, amazonProductUrl });
    
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
    
    const job = await createJob({
      website_url: websiteUrl,
      target_keywords: targetKeywords,
      amazon_url: amazonUrl || null,
      status: 'pending'
    });

    console.log('Job created in database:', job);

    // Start processing automatically (don't wait for it to complete)
    processJobAutomatically(job.id, websiteUrl, targetKeywords, amazonUrl)
      .catch(error => {
        console.error('Auto-processing failed:', error);
      });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job created and processing started automatically'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    
    // Type-safe error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to create job', 
        details: errorMessage,
        step: 'general_error'
      },
      { status: 500 }
    );
  }
}
