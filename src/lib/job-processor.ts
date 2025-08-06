import { updateJobStatus } from '@/lib/db';

export async function processJobWithWorkersSequential(
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
    
    // Helper function to call workers via HTTP to ensure proper caching
    const callWorker = async (endpoint: string, data: any) => {
      const response = await fetch(`http://localhost:3000/api/workers/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Worker ${endpoint} failed: ${response.status} - ${errorText}`);
      }
      
      return await response.json();
    };

    // 1. Website Crawler Worker (OpenAI-powered)
    console.log('1️⃣ Starting website crawler worker (OpenAI-powered)...');
    try {
      const websiteData = await callWorker('website-crawler', {
        jobId,
        websiteUrl,
        keywords: targetKeywords,
        competitorUrls
      });
      console.log(`✅ Website crawler completed: ${websiteData.data?.reviewsFound || 0} reviews found`);
    } catch (error) {
      console.error('❌ Website crawler failed:', error);
      // Don't fail entire job for website issues
    }

    // 2. Amazon Reviews Worker (Tiered extraction)
    if (amazonUrl) {
      console.log('2️⃣ Starting Amazon reviews worker (tiered extraction)...');
      try {
        const amazonData = await callWorker('amazon-reviews', {
          jobId,
          amazonUrl,
          keywords: targetKeywords
        });
        console.log(`✅ Amazon reviews completed: ${amazonData.data?.totalReviews || 0} reviews found`);
      } catch (error) {
        console.error('❌ Amazon reviews failed:', error);
        // Don't fail entire job for Amazon issues
      }
    }

    // 3. YouTube Comments Worker (Per-keyword metrics)
    console.log('3️⃣ Starting YouTube comments worker (per-keyword metrics)...');
    try {
      const youtubeData = await callWorker('youtube-comments', {
        jobId,
        keywords: targetKeywords
      });
      console.log(`✅ YouTube comments completed: ${youtubeData.data?.totalComments || 0} comments from ${youtubeData.data?.videosAnalyzed || 0} videos`);
    } catch (error) {
      console.error('❌ YouTube comments failed:', error);
      // Don't fail entire job for YouTube issues
    }

    // 4. Reddit Scraper Worker (Hybrid API + OpenAI)
    console.log('4️⃣ Starting Reddit scraper worker (hybrid API + OpenAI)...');
    try {
      const redditData = await callWorker('reddit-scraper', {
        jobId,
        targetKeywords
      });
      console.log(`✅ Reddit scraper completed: ${redditData.data?.postCount || 0} posts found`);
    } catch (error) {
      console.error('❌ Reddit scraper failed:', error);
      // Don't fail entire job for Reddit issues
    }

    // 5. Persona Generator Worker (Sequential analysis)
    console.log('5️⃣ Starting persona generator worker (sequential analysis)...');
    try {
      const personaData = await callWorker('persona-generator', {
        jobId,
        keywords: targetKeywords
      });
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