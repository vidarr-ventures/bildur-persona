import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, saveJobData } from '@/lib/db';

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

async function processJobWithWorkersSequential(
  jobId: string, 
  websiteUrl: string, 
  targetKeywords: string, 
  amazonUrl?: string,
  competitorUrls: string[] = []
) {
  try {
    console.log(`🔄 Starting NEW worker-based processing for job ${jobId}`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Import and call workers directly to avoid HTTP overhead
    const { POST: websiteCrawlerWorker } = await import('@/app/api/workers/website-crawler/route');
    const { POST: youtubeWorker } = await import('@/app/api/workers/youtube-comments/route');
    const { POST: redditWorker } = await import('@/app/api/workers/reddit-scraper/route');
    const { POST: amazonWorker } = await import('@/app/api/workers/amazon-reviews/route');
    const { POST: personaWorker } = await import('@/app/api/workers/persona-generator/route');

    // 1. Website Crawler Worker (OpenAI-powered)
    console.log('1️⃣ Starting website crawler worker (OpenAI-powered)...');
    try {
      const websiteRequest = new Request('http://localhost:3000/api/workers/website-crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          websiteUrl,
          keywords: targetKeywords,
          competitorUrls
        })
      });
      
      const websiteResult = await websiteCrawlerWorker(websiteRequest as any);
      const websiteData = await websiteResult.json();
      console.log(`✅ Website crawler completed: ${websiteData.data?.reviewsFound || 0} reviews found`);
    } catch (error) {
      console.error('❌ Website crawler failed:', error);
      // Don't fail entire job for website issues
    }

    // 2. Amazon Reviews Worker (Tiered extraction)
    if (amazonUrl) {
      console.log('2️⃣ Starting Amazon reviews worker (tiered extraction)...');
      try {
        const amazonRequest = new Request('http://localhost:3000/api/workers/amazon-reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            amazonUrl,
            keywords: targetKeywords
          })
        });
        
        const amazonResult = await amazonWorker(amazonRequest as any);
        const amazonData = await amazonResult.json();
        console.log(`✅ Amazon reviews completed: ${amazonData.data?.totalReviews || 0} reviews found`);
      } catch (error) {
        console.error('❌ Amazon reviews failed:', error);
        // Don't fail entire job for Amazon issues
      }
    }

    // 3. YouTube Comments Worker (Per-keyword metrics)
    console.log('3️⃣ Starting YouTube comments worker (per-keyword metrics)...');
    try {
      const youtubeRequest = new Request('http://localhost:3000/api/workers/youtube-comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          keywords: targetKeywords
        })
      });
      
      const youtubeResult = await youtubeWorker(youtubeRequest as any);
      const youtubeData = await youtubeResult.json();
      console.log(`✅ YouTube comments completed: ${youtubeData.data?.totalComments || 0} comments from ${youtubeData.data?.videosAnalyzed || 0} videos`);
    } catch (error) {
      console.error('❌ YouTube comments failed:', error);
      // Don't fail entire job for YouTube issues
    }

    // 4. Reddit Scraper Worker (Hybrid API + OpenAI)
    console.log('4️⃣ Starting Reddit scraper worker (hybrid API + OpenAI)...');
    try {
      const redditRequest = new Request('http://localhost:3000/api/workers/reddit-scraper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          targetKeywords
        })
      });
      
      const redditResult = await redditWorker(redditRequest as any);
      const redditData = await redditResult.json();
      console.log(`✅ Reddit scraper completed: ${redditData.data?.postCount || 0} posts found`);
    } catch (error) {
      console.error('❌ Reddit scraper failed:', error);
      // Don't fail entire job for Reddit issues
    }

    // 5. Persona Generator Worker (Sequential analysis)
    console.log('5️⃣ Starting persona generator worker (sequential analysis)...');
    try {
      const personaRequest = new Request('http://localhost:3000/api/workers/persona-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          keywords: targetKeywords
        })
      });
      
      const personaResult = await personaWorker(personaRequest as any);
      const personaData = await personaResult.json();
      console.log(`✅ Persona generator completed: Stage ${personaData.data?.stageNumber || 1} analysis`);
    } catch (error) {
      console.error('❌ Persona generator failed:', error);
      await updateJobStatus(jobId, 'failed');
      throw new Error(`Persona generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Complete the job
    await updateJobStatus(jobId, 'completed');
    
    console.log(`🎉 Job ${jobId} completed successfully using NEW worker system!`);
    console.log(`📊 Summary of improvements now ACTIVE in production:`);
    console.log(`   ✅ Website: OpenAI-powered extraction (replaced basic scraping)`);
    console.log(`   ✅ Amazon: Tiered review extraction (replaced mock data)`);
    console.log(`   ✅ YouTube: Per-keyword comment analysis with metrics`);
    console.log(`   ✅ Reddit: Hybrid API + OpenAI analysis (was not implemented)`);
    console.log(`   ✅ Persona: Sequential multi-stage analysis (replaced mock)`);

  } catch (error) {
    console.error(`❌ Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
    throw error;
  }
}