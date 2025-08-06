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
    const redditResult = await customRedditScraper.searchAndAnalyze(targetKeywords, {
      maxPosts: 20,
      includeComments: true,
      maxCommentsPerPost: 10
    });

    const analysis = {
      totalPosts: redditResult.posts?.length || 0,
      totalComments: redditResult.posts?.reduce((total, post) => total + (post.comments?.length || 0), 0) || 0,
      sentiment: redditResult.analysis?.sentiment || { positive: 0, negative: 0, neutral: 0 },
      topics: redditResult.analysis?.topics || [],
      painPoints: redditResult.analysis?.painPoints || [],
      solutions: redditResult.analysis?.solutions || [],
      insights: redditResult.analysis?.insights || []
    };

    const result = {
      posts: redditResult.posts || [],
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        targetKeywords: targetKeywords,
        extractionMethod: 'reddit_api_v1_plus_openai',
        subredditsSearched: redditResult.metadata?.subreddits || [],
        searchQueries: redditResult.metadata?.queries || []
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