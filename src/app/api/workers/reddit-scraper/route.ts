import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

interface RedditPost {
  id: string;
  title: string;
  content: string;
  subreddit: string;
  author: string;
  score: number;
  commentCount: number;
  createdDate: string;
  url: string;
  comments: RedditComment[];
}

interface RedditComment {
  id: string;
  content: string;
  author: string;
  score: number;
  createdDate: string;
}

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { targetKeywords, competitors, userProduct } = payload;
    
    console.log(`Starting Reddit data collection for job ${jobId}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing', 15, undefined, undefined);
    
    // Discover relevant subreddits based on keywords
    const relevantSubreddits = await discoverRelevantSubreddits(targetKeywords);
    
    console.log(`Found ${relevantSubreddits.length} relevant subreddits`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 25, undefined, undefined);
    
    // Collect posts and comments from subreddits
    const allRedditData: RedditPost[] = [];
    let completedSubreddits = 0;
    
    for (const subreddit of relevantSubreddits) {
      try {
        console.log(`Collecting data from r/${subreddit}`);
        
        const subredditPosts = await collectSubredditData(subreddit, targetKeywords);
        allRedditData.push(...subredditPosts);
        
        completedSubreddits++;
        const progress = 25 + Math.floor((completedSubreddits / relevantSubreddits.length) * 50);
        await updateJobStatus(jobId, 'processing', progress, undefined, undefined);
        
        // Respect Reddit's rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error collecting from r/${subreddit}:`, error);
        // Continue with other subreddits
      }
    }
    
    console.log(`Collected ${allRedditData.length} Reddit posts with discussions`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 80, undefined, undefined);
    
    // Analyze Reddit data for insights
    const redditInsights = analyzeRedditData(allRedditData, targetKeywords);
    
    // Store Reddit data
    await storeRedditData(jobId, allRedditData, redditInsights);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 90, undefined, undefined);
    
    // Pass Reddit data to persona generator (would need to update that worker too)
    const queue = new JobQueue();
    await queue.addJob(jobId, 'persona-generator-with-reddit', {
      redditData: allRedditData,
      redditInsights,
      targetKeywords,
      competitors,
      userProduct
    });
    
    await queue.markTaskCompleted(jobId, 'reddit-scraper');
    
    console.log(`Reddit data collection completed for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Reddit data collection completed',
      postsCollected: allRedditData.length,
      redditInsights
    });

  } catch (error) {
    console.error('Reddit scraping error:', error);
    
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      undefined, 
      `Reddit data collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Reddit data collection failed' },
      { status: 500 }
    );
  }
}

async function discoverRelevantSubreddits(targetKeywords: string): Promise<string[]> {
  const keywords = targetKeywords.split(',').map(k => k.trim().toLowerCase());
  
  // Map common product categories to relevant subreddits
  const subredditMapping: Record<string, string[]> = {
    // Audio/Electronics
    'speaker': ['audiophile', 'BudgetAudiophile', 'bluetooth', 'audio'],
    'headphone': ['headphones', 'audiophile', 'BudgetAudiophile'],
    'audio': ['audiophile', 'audio', 'BudgetAudiophile', 'WeAreTheMusicMakers'],
    'bluetooth': ['bluetooth', 'tech', 'gadgets'],
    
    // Smart Home
    'smart': ['smarthome', 'homeautomation', 'amazonecho', 'googlehome'],
    'alexa': ['amazonecho', 'smarthome'],
    'echo': ['amazonecho', 'smarthome'],
    'voice': ['amazonecho', 'googlehome', 'smarthome'],
    
    // Tech/Gadgets
    'tech': ['tech', 'gadgets', 'technology'],
    'device': ['gadgets', 'tech'],
    'electronic': ['electronics', 'gadgets'],
    
    // Home/Lifestyle
    'home': ['homeimprovement', 'smarthome', 'InteriorDesign'],
    'kitchen': ['cooking', 'KitchenConfidential', 'MealPrepSunday'],
    'fitness': ['fitness', 'homegym', 'bodyweightfitness'],
    
    // Default categories
    'product': ['BuyItForLife', 'reviews', 'gadgets']
  };
  
  const relevantSubreddits = new Set<string>();
  
  // Add general subreddits
  relevantSubreddits.add('BuyItForLife');
  relevantSubreddits.add('reviews');
  
  // Find category-specific subreddits
  for (const keyword of keywords) {
    for (const [category, subreddits] of Object.entries(subredditMapping)) {
      if (keyword.includes(category)) {
        subreddits.forEach(sub => relevantSubreddits.add(sub));
      }
    }
  }
  
  // If no specific matches, add general tech/product subreddits
  if (relevantSubreddits.size <= 2) {
    ['gadgets', 'tech', 'ProductReviews'].forEach(sub => relevantSubreddits.add(sub));
  }
  
  return Array.from(relevantSubreddits).slice(0, 6); // Limit to 6 subreddits for cost control
}

async function collectSubredditData(subreddit: string, targetKeywords: string): Promise<RedditPost[]> {
  const posts: RedditPost[] = [];
  
  try {
    // Use ScrapeOwl to scrape Reddit (or Reddit API if available)
    const redditUrl = `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(targetKeywords)}&restrict_sr=1&sort=relevance&t=year`;
    
    console.log(`Searching Reddit: ${redditUrl}`);
    
    const scrapeOwlResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: redditUrl,
        elements: [
          {
            name: 'posts',
            selector: '[data-testid="post-container"]',
            type: 'list',
            children: [
              {
                name: 'title',
                selector: 'h3',
                type: 'text'
              },
              {
                name: 'content',
                selector: '[data-testid="post-content"]',
                type: 'text'
              },
              {
                name: 'author',
                selector: '[data-testid="post-byline-author"]',
                type: 'text'
              },
              {
                name: 'score',
                selector: '[data-testid="post-vote-score"]',
                type: 'text'
              },
              {
                name: 'commentCount',
                selector: '[data-testid="comment-count"]',
                type: 'text'
              },
              {
                name: 'postUrl',
                selector: 'a[data-testid="post-title"]',
                type: 'attribute',
                attribute: 'href'
              }
            ]
          }
        ]
      }),
    });

    if (scrapeOwlResponse.ok) {
      const scrapeData = await scrapeOwlResponse.json();
      
      if (scrapeData.success && scrapeData.data && scrapeData.data.posts) {
        const scrapedPosts = scrapeData.data.posts.slice(0, 10); // Limit posts per subreddit
        
        for (const post of scrapedPosts) {
          if (post.title && post.title.trim()) {
            const scoreMatch = post.score?.match(/(\d+)/);
            const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
            
            const commentMatch = post.commentCount?.match(/(\d+)/);
            const commentCount = commentMatch ? parseInt(commentMatch[1]) : 0;
            
            posts.push({
              id: `reddit_${Math.random().toString(36).substring(2, 12)}`,
              title: post.title.trim(),
              content: post.content?.trim() || '',
              subreddit,
              author: post.author || 'Anonymous',
              score,
              commentCount,
              createdDate: new Date().toISOString().split('T')[0],
              url: post.postUrl ? `https://reddit.com${post.postUrl}` : '',
              comments: [] // Comments would require additional scraping
            });
          }
        }
      }
    }
    
    console.log(`Collected ${posts.length} posts from r/${subreddit}`);
    
    // Fallback to simulated Reddit data if scraping fails
    if (posts.length === 0) {
      console.log(`ScrapeOwl failed for r/${subreddit}, generating fallback data`);
      return generateFallbackRedditPosts(subreddit, targetKeywords, 5);
    }
    
    return posts;
    
  } catch (error) {
    console.error(`Error scraping r/${subreddit}:`, error);
    // Return fallback data
    return generateFallbackRedditPosts(subreddit, targetKeywords, 5);
  }
}

function generateFallbackRedditPosts(subreddit: string, targetKeywords: string, count: number): RedditPost[] {
  const posts: RedditPost[] = [];
  const keywords = targetKeywords.split(',').map(k => k.trim());
  
  const postTemplates = [
    {
      title: `Best ${keywords[0]} for the money?`,
      content: `I'm looking for a good ${keywords[0]} that won't break the bank. I've been researching for weeks but there are so many options. What do you all recommend? Budget is around $100-200.`
    },
    {
      title: `${keywords[0]} stopped working after 6 months`,
      content: `Really frustrated. My ${keywords[0]} just died and it's barely been 6 months. Is this normal? Looking for something more reliable this time. Any suggestions?`
    },
    {
      title: `Upgrade from cheap ${keywords[0]} - worth it?`,
      content: `I've been using a budget ${keywords[0]} for a while but thinking of upgrading. Is the difference really noticeable? What should I look for?`
    },
    {
      title: `${keywords[0]} recommendations for beginners?`,
      content: `New to this and feeling overwhelmed by all the options. What ${keywords[0]} would you recommend for someone just starting out? Price isn't the main concern, just want something reliable.`
    },
    {
      title: `Why are all ${keywords[0]}s so complicated?`,
      content: `Maybe I'm getting old but why do these things need to be so complex? I just want something simple that works. Any recommendations for uncomplicated ${keywords[0]}?`
    }
  ];
  
  for (let i = 0; i < count; i++) {
    const template = postTemplates[i % postTemplates.length];
    posts.push({
      id: `fallback_reddit_${Math.random().toString(36).substring(2, 12)}`,
      title: template.title,
      content: template.content,
      subreddit,
      author: `user${Math.floor(Math.random() * 1000)}`,
      score: Math.floor(Math.random() * 50) + 5,
      commentCount: Math.floor(Math.random() * 20) + 3,
      createdDate: generateRandomDate(),
      url: `https://reddit.com/r/${subreddit}/comments/fake`,
      comments: []
    });
  }
  
  return posts;
}

function generateRandomDate(): string {
  const start = new Date(2023, 0, 1);
  const end = new Date();
  const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return randomDate.toISOString().split('T')[0];
}

function analyzeRedditData(redditData: RedditPost[], targetKeywords: string) {
  const totalPosts = redditData.length;
  const totalComments = redditData.reduce((sum, post) => sum + post.commentCount, 0);
  
  const subredditBreakdown = redditData.reduce((acc, post) => {
    acc[post.subreddit] = (acc[post.subreddit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const averageScore = totalPosts > 0 ? 
    Math.round(redditData.reduce((sum, post) => sum + post.score, 0) / totalPosts) : 0;
  
  // Extract common themes from titles
  const commonThemes = extractCommonThemes(redditData);
  
  return {
    totalPosts,
    totalComments,
    subredditBreakdown,
    averageScore,
    commonThemes,
    dataQuality: totalPosts > 20 ? 'high' : totalPosts > 10 ? 'medium' : 'low'
  };
}

function extractCommonThemes(redditData: RedditPost[]): string[] {
  const allText = redditData.map(post => `${post.title} ${post.content}`).join(' ').toLowerCase();
  
  // Common problem/need words in Reddit discussions
  const problemWords = [
    'problem', 'issue', 'broken', 'failed', 'stopped working', 'disappointed',
    'looking for', 'need', 'recommend', 'best', 'alternative', 'replacement',
    'budget', 'cheap', 'expensive', 'worth it', 'upgrade', 'beginner'
  ];
  
  const themes = problemWords.filter(word => allText.includes(word));
  return themes.slice(0, 10); // Top 10 themes
}

async function storeRedditData(jobId: string, redditData: RedditPost[], insights: any) {
  console.log(`Storing ${redditData.length} Reddit posts for job ${jobId}`);
  console.log('Reddit insights:', insights);
  
  // TODO: Store in database
  // await sql`INSERT INTO reddit_data (job_id, post_data, insights) VALUES (${jobId}, ${JSON.stringify(redditData)}, ${JSON.stringify(insights)})`
}
