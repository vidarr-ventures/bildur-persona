import { updateJobStatus, saveJobData, completeJob } from '@/lib/db';
import { websiteCrawlerWorker } from './workers/website-crawler-worker';
import { amazonReviewsWorker } from './workers/amazon-reviews-worker';
import { youtubeCommentsWorker } from './workers/youtube-comments-worker';
import { redditScraperWorker } from './workers/reddit-scraper-worker';
import { personaGeneratorWorker } from './workers/persona-generator-worker';

export async function processJobWithWorkersSequential(
  jobId: string, 
  websiteUrl: string, 
  targetKeywords: string, 
  amazonUrl?: string,
  competitorUrls: string[] = []
) {
  try {
    console.log(`🔄 Starting FIXED worker-based processing for job ${jobId}`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    let hasAnySuccess = false;
    
    // 1. Website Crawler Worker (Direct function call)
    console.log('1️⃣ Starting website crawler worker (direct call)...');
    try {
      const websiteData = await websiteCrawlerWorker({
        jobId,
        websiteUrl,
        targetKeywords,
        competitorUrls
      });
      
      await saveJobData(jobId, 'website', websiteData);
      console.log(`✅ Website crawler completed: ${websiteData.analysis?.reviewsFound || 0} reviews found`);
      hasAnySuccess = true;
    } catch (error) {
      console.error('❌ Website crawler failed:', error);
      await saveJobData(jobId, 'website', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    // 2. Amazon Reviews Worker (Direct function call)
    if (amazonUrl && amazonUrl.trim() !== '') {
      console.log('2️⃣ Starting Amazon reviews worker (direct call)...');
      try {
        const amazonData = await amazonReviewsWorker({
          jobId,
          amazonUrl,
          targetKeywords,
          planName: 'Essential' // Default plan
        });
        
        await saveJobData(jobId, 'amazon_reviews', amazonData);
        console.log(`✅ Amazon reviews completed: ${amazonData.analysis?.totalReviews || 0} reviews found`);
        hasAnySuccess = true;
      } catch (error) {
        console.error('❌ Amazon reviews failed:', error);
        await saveJobData(jobId, 'amazon_reviews', { 
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      console.log('2️⃣ Skipping Amazon reviews worker (no URL provided)');
      await saveJobData(jobId, 'amazon_reviews', { 
        skipped: true,
        reason: 'No Amazon URL provided',
        timestamp: new Date().toISOString()
      });
    }

    // 3. YouTube Comments Worker (Direct function call)
    console.log('3️⃣ Starting YouTube comments worker (direct call)...');
    try {
      const youtubeData = await youtubeCommentsWorker({
        jobId,
        keywords: targetKeywords
      });
      
      await saveJobData(jobId, 'youtube_comments', youtubeData);
      console.log(`✅ YouTube comments completed: ${youtubeData.analysis?.totalComments || 0} comments`);
      hasAnySuccess = true;
    } catch (error) {
      console.error('❌ YouTube comments failed:', error);
      await saveJobData(jobId, 'youtube_comments', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    // 4. Reddit Scraper Worker (Direct function call)
    console.log('4️⃣ Starting Reddit scraper worker (direct call)...');
    try {
      const redditData = await redditScraperWorker({
        jobId,
        targetKeywords
      });
      
      await saveJobData(jobId, 'reddit', redditData);
      console.log(`✅ Reddit scraper completed: ${redditData.analysis?.totalPosts || 0} posts found`);
      hasAnySuccess = true;
    } catch (error) {
      console.error('❌ Reddit scraper failed:', error);
      await saveJobData(jobId, 'reddit', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    // 5. Persona Generator Worker (Direct function call)
    console.log('5️⃣ Starting persona generator worker (direct call)...');
    try {
      const personaData = await personaGeneratorWorker({
        jobId,
        websiteUrl,
        targetKeywords,
        amazonUrl,
        email: 'test@example.com', // Default for testing
        planName: 'Essential'
      });
      
      await saveJobData(jobId, 'persona_profile', personaData);
      console.log(`✅ Persona generator completed: Stage ${personaData.stageNumber || 1} analysis`);
      hasAnySuccess = true;
    } catch (error) {
      console.error('❌ Persona generator failed:', error);
      await saveJobData(jobId, 'persona_profile', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }

    // Complete the job if we had at least one successful worker
    if (hasAnySuccess) {
      await completeJob(jobId);
      console.log(`🎉 Job ${jobId} completed successfully with FIXED worker system!`);
    } else {
      await updateJobStatus(jobId, 'failed');
      console.log(`❌ Job ${jobId} failed - no workers succeeded`);
    }
    
    console.log(`📊 Summary of FIXED processing pipeline:`);
    console.log(`   ✅ Website: Direct function call (no HTTP timeout issues)`);
    console.log(`   ✅ Amazon: Direct function call (no HTTP timeout issues)`);
    console.log(`   ✅ YouTube: Direct function call (no HTTP timeout issues)`);
    console.log(`   ✅ Reddit: Direct function call (no HTTP timeout issues)`);
    console.log(`   ✅ Persona: Direct function call (no HTTP timeout issues)`);

  } catch (error) {
    console.error(`❌ Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
    throw error;
  }
}