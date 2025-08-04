import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { customRedditScraper } from '@/lib/custom-reddit-scraper';
import { storeJobResult } from '@/lib/job-cache';

interface RedditPost {
  title: string;
  content: string;
  score: number;
  comments: number;
  subreddit: string;
  url: string;
  timestamp: string;
}

async function discoverRelevantSubreddits(keywords: string): Promise<string[]> {
  const baseSubreddits = [
    'reviews', 'BuyItForLife', 'ProductPorn', 'shutupandtakemymoney',
    'findareddit', 'tipofmytongue', 'HelpMeFind', 'whatisthisthing'
  ];
  
  const keywordSubreddits = keywords.toLowerCase().split(' ')
    .filter(word => word.length > 3)
    .slice(0, 3);
  
  return [...baseSubreddits, ...keywordSubreddits];
}

async function scrapeRedditData(subreddits: string[], keywords: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  
  for (const subreddit of subreddits.slice(0, 5)) {
    try {
      const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'PersonaBot/1.0'
        }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.data?.children) {
        for (const child of data.data.children) {
          const post = child.data;
          posts.push({
            title: post.title || '',
            content: post.selftext || '',
            score: post.score || 0,
            comments: post.num_comments || 0,
            subreddit: post.subreddit || subreddit,
            url: `https://reddit.com${post.permalink}`,
            timestamp: new Date(post.created_utc * 1000).toISOString()
          });
        }
      }
    } catch (error) {
      console.error(`Error scraping r/${subreddit}:`, error);
    }
  }
  
  return posts.sort((a, b) => b.score - a.score).slice(0, 20);
}

function analyzeRedditSentiment(posts: RedditPost[]): any {
  const totalPosts = posts.length;
  const averageScore = posts.reduce((sum, post) => sum + post.score, 0) / totalPosts;
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);
  
  const sentimentKeywords = {
    positive: ['love', 'great', 'amazing', 'excellent', 'recommend', 'perfect', 'best'],
    negative: ['hate', 'terrible', 'awful', 'worst', 'disappointed', 'bad', 'poor']
  };
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  posts.forEach(post => {
    const text = (post.title + ' ' + post.content).toLowerCase();
    sentimentKeywords.positive.forEach(word => {
      if (text.includes(word)) positiveCount++;
    });
    sentimentKeywords.negative.forEach(word => {
      if (text.includes(word)) negativeCount++;
    });
  });
  
  return {
    totalPosts,
    averageScore,
    totalComments,
    sentiment: {
      positive: positiveCount,
      negative: negativeCount,
      ratio: positiveCount / Math.max(negativeCount, 1)
    },
    topSubreddits: [...new Set(posts.map(p => p.subreddit))],
    commonThemes: extractCommonThemes(posts)
  };
}

function extractCommonThemes(posts: RedditPost[]): string[] {
  const allText = posts.map(p => p.title + ' ' + p.content).join(' ').toLowerCase();
  const words = allText.split(/\s+/).filter(word => word.length > 4);
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const { jobId, targetKeywords } = await request.json();

    if (!jobId || !targetKeywords) {
      return NextResponse.json({ error: 'Job ID and target keywords are required' }, { status: 400 });
    }

    console.log(`Starting Reddit data collection for job ${jobId} with keywords: ${targetKeywords}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing');
    
    // Use custom Reddit scraper for cost optimization
    console.log(`🔍 Using custom Reddit scraper to eliminate Firecrawl costs`);
    const scrapingResult = await customRedditScraper.scrapeRedditDiscussions(targetKeywords, 50);
    
    // Transform to match expected format
    const redditPosts = scrapingResult.posts.map(post => ({
      title: post.title,
      content: post.text,
      score: post.score,
      comments: post.num_comments,
      subreddit: post.subreddit,
      url: post.permalink,
      timestamp: new Date(post.created_utc * 1000).toISOString()
    }));
    
    // Include comments as additional posts
    const commentPosts = scrapingResult.comments.map((comment, index) => ({
      title: `Comment #${index + 1}`,
      content: comment.text,
      score: comment.score,
      comments: 0,
      subreddit: 'comments',
      url: `comment_${comment.id}`,
      timestamp: new Date(comment.created_utc * 1000).toISOString()
    }));
    
    const allRedditData = [...redditPosts, ...commentPosts];
    
    // Store result in cache for debug dashboard
    storeJobResult(jobId, 'reddit', {
      success: scrapingResult.success,
      posts: allRedditData,
      metadata: scrapingResult.metadata,
      processingTime: scrapingResult.metadata.processing_time,
      statusCode: scrapingResult.success ? 200 : 500,
      error: scrapingResult.error
    });

    await updateJobStatus(jobId, 'processing');
    
    if (allRedditData.length === 0) {
      console.log('No Reddit posts found, saving empty results');
      await saveJobData(jobId, 'reddit', {
        posts: [],
        analysis: { message: 'No relevant Reddit discussions found' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Reddit scraping completed (no posts found)',
        data: { postCount: 0 }
      });
    }

    await updateJobStatus(jobId, 'processing');
    
    // Analyze sentiment and extract insights
    const analysis = analyzeRedditSentiment(allRedditData);
    
    const redditData = {
      posts: allRedditData,
      analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        subreddits: scrapingResult.metadata.subreddits_searched,
        extraction_method: scrapingResult.metadata.extraction_method,
        cost_savings: scrapingResult.metadata.cost_savings,
        totalPosts: allRedditData.length
      }
    };

    await updateJobStatus(jobId, 'processing');

    // Save the Reddit analysis data
    await saveJobData(jobId, 'reddit', redditData);

    console.log(`Reddit data collection completed for job ${jobId}. Found ${redditPosts.length} posts.`);

    return NextResponse.json({
      success: true,
      message: 'Reddit data collection completed',
      data: {
        postCount: allRedditData.length,
        subreddits: scrapingResult.metadata.subreddits_searched.length,
        sentiment: analysis.sentiment
      }
    });

  } catch (error) {
    console.error('Reddit scraping error:', error);
    
    try {
      const { jobId } = await request.json();
      if (jobId) {
        await updateJobStatus(jobId, 'failed');
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Reddit scraping failed', details: errorMessage },
      { status: 500 }
    );
  }
}
