import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const websiteUrl = body.primaryProductUrl;
    const amazonUrl = body.amazonProductUrl;
    const targetKeywords = body.targetKeywords;
    const competitorUrls = body.competitorUrls || [];

    console.log('🚀 Creating job with direct processing:', { 
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
      status: 'processing'
    });

    console.log(`✅ Job created successfully: ${job.id}`);

    // TODO: Implement direct API processing here
    // For now, just mark as completed with placeholder data
    await updateJobStatus(job.id, 'completed');

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Job created successfully - direct processing will be implemented next'
    });

  } catch (error) {
    console.error('❌ Job creation error:', error);
    return NextResponse.json({ 
      error: 'Failed to create analysis job', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

