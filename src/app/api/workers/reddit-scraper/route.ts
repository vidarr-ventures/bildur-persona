import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';

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
    
    // Discover relevant subreddits based on keywords
    const relevantSubreddits = await discoverRelevantSubreddits(targetKeywords);
    console.log(`Discovered ${relevantSubreddits.length} relevant subreddits:`, relevantSubreddits);

    await updateJobStatus(jobId, 'processing');
    
    // Scrape Reddit data from relevant subreddits
    console.log(`Scraping Reddit posts from subreddits...`);
    const redditPosts = await scrapeRedditData(relevantSubreddits, targetKeywords);
    
    if (redditPosts.length === 0) {
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
    const analysis = analyzeRedditSentiment(redditPosts);
    
    const redditData = {
      posts: redditPosts,
      analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        subreddits: relevantSubreddits,
        totalPosts: redditPosts.length
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
        postCount: redditPosts.length,
        subreddits: relevantSubreddits.length,
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
