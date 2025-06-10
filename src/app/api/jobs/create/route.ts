import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const websiteUrl = body.primaryProductUrl; // Website URL
    const amazonUrl = body.amazonProductUrl; // Amazon URL  
    const targetKeywords = body.targetKeywords;

    // Validate required fields
    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400 }
      );
    }

    if (!targetKeywords) {
      return NextResponse.json(
        { error: 'Target keywords are required' },
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
        
        // Check if it's actually an Amazon URL
        if (!amazonUrl.match(/amazon\.(com|ca|co\.uk|de|fr|it|es|co\.jp|in|com\.au|com\.mx|com\.br)/)) {
          return NextResponse.json(
            { error: 'Please provide a valid Amazon product URL' },
            { status: 400 }
          );
        }
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

    console.log('Job created successfully:', job.id);

    // Start processing workflow with better error handling
    await initiateJobProcessing(job.id, websiteUrl, targetKeywords, amazonUrl);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Analysis started successfully'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create analysis job', details: errorMessage },
      { status: 500 }
    );
  }
}

async function initiateJobProcessing(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`=== Starting job processing workflow for ${jobId} ===`);
    
    // Determine the base URL more reliably
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
                    (process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'http://localhost:3000');
    
    console.log(`Using base URL: ${baseUrl}`);

    // Update job status to processing immediately
    await updateJobStatus(jobId, 'processing');
    console.log('Job status updated to processing');

    // Start with website crawling with comprehensive error handling
    console.log('Starting website crawler...');
    try {
      const websiteResponse = await fetch(`${baseUrl}/api/workers/website-crawler`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'User-Agent': 'CustomerPersonaApp/1.0'
        },
        body: JSON.stringify({
          jobId,
          websiteUrl,
          targetKeywords
        }),
        // Add timeout
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      console.log(`Website crawler response status: ${websiteResponse.status}`);
      
      if (!websiteResponse.ok) {
        const errorText = await websiteResponse.text();
        console.error('Website crawler failed:', errorText);
      } else {
        const responseData = await websiteResponse.json();
        console.log('Website crawler completed successfully:', responseData);
      }
    } catch (websiteError) {
      console.error('Website crawler error:', websiteError);
    }

    // Start Amazon reviews extraction if URL provided
    if (amazonUrl) {
      console.log('Starting Amazon reviews extraction...');
      try {
        const amazonResponse = await fetch(`${baseUrl}/api/workers/amazon-reviews`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'CustomerPersonaApp/1.0'
          },
          body: JSON.stringify({
            jobId,
            amazonUrl,
            targetKeywords
          }),
          // Add timeout
          signal: AbortSignal.timeout(60000) // 60 second timeout for Amazon (slower)
        });

        console.log(`Amazon reviews response status: ${amazonResponse.status}`);
        
        if (!amazonResponse.ok) {
          const errorText = await amazonResponse.text();
          console.error('Amazon reviews worker failed:', errorText);
        } else {
          const responseData = await amazonResponse.json();
          console.log('Amazon reviews extraction completed successfully:', responseData);
        }
      } catch (amazonError) {
        console.error('Amazon reviews error:', amazonError);
      }
    } else {
      console.log('No Amazon URL provided, skipping Amazon extraction');
    }

    // Wait a bit for data collection, then start persona generation
    console.log('Scheduling persona generation...');
    setTimeout(async () => {
      try {
        console.log('Starting persona generation...');
        const personaResponse = await fetch(`${baseUrl}/api/workers/persona-generator`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'CustomerPersonaApp/1.0'
          },
          body: JSON.stringify({
            jobId,
            websiteUrl,
            targetKeywords,
            amazonUrl
          }),
          signal: AbortSignal.timeout(45000) // 45 second timeout
        });

        console.log(`Persona generator response status: ${personaResponse.status}`);
        
        if (!personaResponse.ok) {
          const errorText = await personaResponse.text();
          console.error('Persona generator failed:', errorText);
        } else {
          const responseData = await personaResponse.json();
          console.log('Persona generation completed successfully:', responseData);
        }
      } catch (personaError) {
        console.error('Error in persona generation:', personaError);
      }
    }, 15000); // Wait 15 seconds for data collection

    console.log('=== Job processing workflow initiated successfully ===');

  } catch (error) {
    console.error('Error in job processing workflow:', error);
    
    // Try to update job status to failed
    try {
      await updateJobStatus(jobId, 'failed');
    } catch (statusError) {
      console.error('Failed to update job status to failed:', statusError);
    }
  }
}
