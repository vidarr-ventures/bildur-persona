import { customRedditScraper } from '../custom-reddit-scraper';

/**
 * Reddit scraper worker - direct function call version
 * Uses the existing custom Reddit scraper
 */
export async function redditScraperWorker({
  jobId,
  targetKeywords
}: {
  jobId: string;
  targetKeywords: string;
}) {
  console.log(`🤖 Starting Reddit scraper worker for job ${jobId}`);
  console.log(`🔍 Keywords: ${targetKeywords}`);

  try {
    // Use the existing custom Reddit scraper
    const redditResult = await customRedditScraper.scrapeRedditDiscussions(targetKeywords, 20);

    const analysis = {
      totalPosts: redditResult.posts?.length || 0,
      totalComments: redditResult.comments?.length || 0,
      sentiment: { positive: 0, negative: 0, neutral: 0 }, // Will be added by AI analysis later
      topics: [], // Will be extracted by AI analysis
      painPoints: [], // Will be extracted by AI analysis
      solutions: [], // Will be extracted by AI analysis  
      insights: [] // Will be extracted by AI analysis
    };

    const result = {
      posts: redditResult.posts || [],
      comments: redditResult.comments || [],
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        targetKeywords: targetKeywords,
        extractionMethod: 'reddit_api_v1_plus_openai',
        subredditsSearched: redditResult.metadata?.subreddits_searched || [],
        searchQueries: redditResult.metadata?.queries_used || [],
        processingTime: redditResult.metadata?.processing_time || 0,
        totalResults: redditResult.metadata?.total_results || 0
      }
    };

    console.log(`✅ Reddit scraper completed for job ${jobId}`);
    console.log(`📊 Results: ${analysis.totalPosts} posts, ${analysis.totalComments} comments`);
    
    return result;

  } catch (error) {
    console.error(`❌ Reddit scraper failed for job ${jobId}:`, error);
    
    // Return minimal data on failure so the pipeline can continue
    const fallbackResult = {
      posts: [],
      analysis: {
        totalPosts: 0,
        totalComments: 0,
        sentiment: { positive: 0, negative: 0, neutral: 0 },
        topics: [],
        painPoints: [],
        solutions: [],
        insights: []
      },
      metadata: {
        timestamp: new Date().toISOString(),
        targetKeywords: targetKeywords,
        extractionMethod: 'reddit_api_failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };

    return fallbackResult;
  }
}