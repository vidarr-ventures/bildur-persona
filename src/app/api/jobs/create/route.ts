import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, targetKeywords, amazonUrl } = await request.json();

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

    // Start processing workflow
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
    console.log(`Starting job processing workflow for ${jobId}`);

    // Start with website crawling
    const websiteResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workers/website-crawler`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId,
        websiteUrl,
        targetKeywords
      })
    });

    if (!websiteResponse.ok) {
      console.error('Website crawler failed:', await websiteResponse.text());
    }

    // Start Amazon reviews extraction if URL provided
    if (amazonUrl) {
      const amazonResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workers/amazon-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          amazonUrl,
          targetKeywords
        })
      });

      if (!amazonResponse.ok) {
        console.error('Amazon reviews worker failed:', await amazonResponse.text());
      }
    }

    // Wait a bit for data collection, then start persona generation
    setTimeout(async () => {
      try {
        const personaResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/workers/persona-generator`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            websiteUrl,
            targetKeywords,
            amazonUrl
          })
        });

        if (!personaResponse.ok) {
          console.error('Persona generator failed:', await personaResponse.text());
        }
      } catch (error) {
        console.error('Error in persona generation:', error);
      }
    }, 15000); // Wait 15 seconds for data collection

  } catch (error) {
    console.error('Error in job processing workflow:', error);
  }
}
