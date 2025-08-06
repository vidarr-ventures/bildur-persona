import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';
import { processJobWithWorkersSequential } from '@/lib/job-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const websiteUrl = body.primaryProductUrl;
    const amazonUrl = body.amazonProductUrl;
    const targetKeywords = body.targetKeywords;
    const competitorUrls = body.competitorUrls || [];

    console.log('🚀 Creating job with NEW worker system:', { 
      websiteUrl, 
      targetKeywords, 
      amazonUrl,
      competitorCount: competitorUrls.length 
    });

    // Create job in database
    const job = await createJob({
      website_url: websiteUrl,
      target_keywords: targetKeywords,
      amazon_url: amazonUrl || null,
      status: 'pending'
    });

    console.log(`✅ Job created successfully: ${job.id}`);

    // Process using worker system (sequential for simplicity)
    await processJobWithWorkersSequential(job.id, websiteUrl, targetKeywords, amazonUrl, competitorUrls);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Analysis completed successfully using NEW worker system with all improvements'
    });

  } catch (error) {
    console.error('❌ Job creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create analysis job', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

