import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';

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

async function scrapeRedditReviews(subreddits: string[], keywords: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  
  for (const subreddit of subreddits.slice(0, 5)) {
    try {
      const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`;
      
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'ReviewBot/1.0'
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
  
  return posts.sort((a, b) => b.score - a.score).slice(0, 25);
}

function analyzeCustomerVoice(posts: RedditPost[]): any {
  const totalPosts = posts.length;
  const averageScore = posts.reduce((sum, post) => sum + post.score, 0) / totalPosts;
  const totalComments = posts.reduce((sum, post) => sum + post.comments, 0);
  
  const emotionKeywords = {
    frustration: ['frustrated', 'annoying', 'hate', 'terrible', 'awful', 'disappointed'],
    satisfaction: ['love', 'great', 'amazing', 'excellent', 'recommend', 'perfect'],
    confusion: ['confused', 'unclear', 'complicated', 'difficult', 'hard to understand'],
    excitement: ['excited', 'thrilled', 'amazing', 'incredible', 'blown away']
  };
  
  const emotions = Object.keys(emotionKeywords).reduce((acc, emotion) => {
    acc[emotion] = 0;
    return acc;
  }, {} as Record<string, number>);
  
  posts.forEach(post => {
    const text = (post.title + ' ' + post.content).toLowerCase();
    Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
      keywords.forEach(keyword => {
        if (text.includes(keyword)) emotions[emotion]++;
      });
    });
  });
  
  return {
    totalPosts,
    averageScore,
    totalComments,
    emotions,
    topSubreddits: [...new Set(posts.map(p => p.subreddit))],
    customerNeeds: extractCustomerNeeds(posts),
    painPoints: extractPainPoints(posts),
    commonPhrases: extractCommonPhrases(posts)
  };
}

function extractCustomerNeeds(posts: RedditPost[]): string[] {
  const needPhrases = posts
    .map(p => p.title + ' ' + p.content)
    .join(' ')
    .toLowerCase()
    .match(/(?:need|want|looking for|searching for|require|must have)[\s\w]{1,50}/g) || [];
  
  return [...new Set(needPhrases.slice(0, 10))];
}

function extractPainPoints(posts: RedditPost[]): string[] {
  const painPhrases = posts
    .map(p => p.title + ' ' + p.content)
    .join(' ')
    .toLowerCase()
    .match(/(?:problem|issue|trouble|difficult|hard|annoying|frustrating)[\s\w]{1,50}/g) || [];
  
  return [...new Set(painPhrases.slice(0, 10))];
}

function extractCommonPhrases(posts: RedditPost[]): string[] {
  const allText = posts.map(p => p.title + ' ' + p.content).join(' ').toLowerCase();
  const words = allText.split(/\s+/).filter(word => word.length > 3);
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, targetKeywords } = await request.json();

    if (!jobId || !targetKeywords) {
      return NextResponse.json({ error: 'Job ID and target keywords are required' }, { status: 400 });
    }

    console.log(`Starting customer voice collection for job ${jobId} with keywords: ${targetKeywords}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing');
    
    // Discover relevant subreddits based on keywords
    const relevantSubreddits = await discoverRelevantSubreddits(targetKeywords);
    console.log(`Discovered ${relevantSubreddits.length} relevant subreddits for customer voice:`, relevantSubreddits);

    await updateJobStatus(jobId, 'processing');
    
    // Scrape customer voice data from Reddit
    console.log(`Collecting customer voice data from Reddit...`);
    const customerPosts = await scrapeRedditReviews(relevantSubreddits, targetKeywords);
    
    if (customerPosts.length === 0) {
      console.log('No customer voice data found, saving empty results');
      await saveJobData(jobId, 'reviews', {
        posts: [],
        analysis: { message: 'No relevant customer discussions found' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Customer voice collection completed (no data found)',
        data: { postCount: 0 }
      });
    }

    await updateJobStatus(jobId, 'processing');
    
    // Analyze customer voice and sentiment
    const voiceAnalysis = analyzeCustomerVoice(customerPosts);
    
    const reviewsData = {
      posts: customerPosts,
      analysis: voiceAnalysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        subreddits: relevantSubreddits,
        totalPosts: customerPosts.length,
        dataType: 'customer_voice'
      }
    };

    await updateJobStatus(jobId, 'processing');

    // Save the customer voice analysis data
    await saveJobData(jobId, 'reviews', reviewsData);

    console.log(`Customer voice collection completed for job ${jobId}. Found ${customerPosts.length} posts.`);

    return NextResponse.json({
      success: true,
      message: 'Customer voice collection completed',
      data: {
        postCount: customerPosts.length,
        subreddits: relevantSubreddits.length,
        emotions: voiceAnalysis.emotions,
        needs: voiceAnalysis.customerNeeds.length,
        painPoints: voiceAnalysis.painPoints.length
      }
    });

  } catch (error) {
    console.error('Customer voice collection error:', error);
    
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
      { error: 'Customer voice collection failed', details: errorMessage },
      { status: 500 }
    );
  }
}
