import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, getJobData } from '@/lib/db';

// Execute all workers for a job
async function processJobAutomatically(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`Starting automatic processing for job ${jobId}`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';

    // Initialize data collectors
    let websiteData = null;
    let reviewsData = null;
    let competitorsData = null;

    // Step 1: Website Crawler
    try {
      console.log(`Executing website crawler for job ${jobId}`);
      
      const response = await fetch(`${baseUrl}/api/workers/website-crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          websiteUrl,
          targetKeywords,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Website crawler completed successfully for job ${jobId}`);
        
        // Get the actual website data from the database
        websiteData = await getJobData(jobId, 'website');
        console.log('Retrieved website data:', websiteData ? 'success' : 'failed');
      } else {
        console.error(`Website crawler failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Website crawler error:', error);
    }

    // Step 2: Reviews Collector
    try {
      console.log(`Executing reviews collector for job ${jobId}`);
      
      const response = await fetch(`${baseUrl}/api/workers/reviews-collector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          targetKeywords,
        }),
      });

      if (response.ok) {
        reviewsData = await getJobData(jobId, 'reviews');
        console.log(`Reviews collector completed for job ${jobId}`);
      } else {
        console.error(`Reviews collector failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Reviews collector error:', error);
    }

    // Step 3: Amazon Competitors
    try {
      console.log(`Executing amazon competitors for job ${jobId}`);
      
      const response = await fetch(`${baseUrl}/api/workers/amazon-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          amazonUrl,
        }),
      });

      if (response.ok) {
        competitorsData = await getJobData(jobId, 'amazon_competitors');
        console.log(`Amazon competitors completed for job ${jobId}`);
      } else {
        console.error(`Amazon competitors failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Amazon competitors error:', error);
    }

    // Step 4: Persona Generator with ACTUAL DATA
    try {
      console.log(`Executing persona generator for job ${jobId} with collected data`);
      console.log('Passing data to persona generator:', {
        websiteData: websiteData ? 'available' : 'missing',
        reviewsData: reviewsData ? 'available' : 'missing',
        competitorsData: competitorsData ? 'available' : 'missing'
      });
      
      const response = await fetch(`${baseUrl}/api/workers/persona-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          websiteUrl,
          targetKeywords,
          // PASS THE ACTUAL COLLECTED DATA
          websiteData: websiteData,
          reviewsData: reviewsData, 
          competitorsData: competitorsData
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`Persona generator completed successfully for job ${jobId}`);
        console.log('Persona preview:', result.data?.persona?.substring(0, 200));
      } else {
        console.error(`Persona generator failed: ${response.status}`);
      }
    } catch (error) {
      console.error('Persona generator error:', error);
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
