import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';

interface RedditThread {
  url: string;
  title: string;
  content: string;
  comments: string[];
  subreddit: string;
  score: number;
  timestamp: string;
}

async function searchGoogleForRedditThreads(keywords: string): Promise<string[]> {
  try {
    console.log(`Searching Google for Reddit discussions about: ${keywords}`);
    
    // Use ScrapeOwl to search Google for Reddit threads
    const googleQuery = `site:reddit.com "${keywords}"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&num=20`;
    
    const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: searchUrl,
        elements: [
          { name: 'search_results', selector: 'div[data-ved] a[href*="reddit.com"]', multiple: true, attribute: 'href' },
          { name: 'result_links', selector: 'a[href*="reddit.com/r/"]', multiple: true, attribute: 'href' },
          { name: 'all_links', selector: 'a[href*="reddit.com"]', multiple: true, attribute: 'href' }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Google search failed:', response.status);
      return [];
    }

    const data = await response.json();
    
    // Combine all found Reddit URLs
    const redditUrls = [
      ...(data.search_results || []),
      ...(data.result_links || []),
      ...(data.all_links || [])
    ].filter(url => url && url.includes('reddit.com/r/'))
     .map(url => {
       // Clean up Google redirect URLs
       if (url.includes('/url?q=')) {
         const match = url.match(/[?&]q=([^&]+)/);
         return match ? decodeURIComponent(match[1]) : url;
       }
       return url;
     })
     .filter(url => url.includes('reddit.com/r/') && url.includes('/comments/'))
     .slice(0, 10); // Limit to top 10 results

    console.log(`Found ${redditUrls.length} Reddit thread URLs from Google search`);
    return [...new Set(redditUrls)]; // Remove duplicates
    
  } catch (error) {
    console.error('Error searching Google for Reddit threads:', error);
    return [];
  }
}

async function scrapeRedditThread(url: string): Promise<RedditThread | null> {
  try {
    console.log(`Scraping Reddit thread: ${url}`);
    
    // Convert to old.reddit.com for better scraping
    const oldRedditUrl = url.replace('www.reddit.com', 'old.reddit.com').replace('reddit.com', 'old.reddit.com');
    
    const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: oldRedditUrl,
        elements: [
          // Get thread title
          { name: 'title', selector: '.title .may-blank, h1' },
          
          // Get original post content
          { name: 'post_content', selector: '.usertext-body .md, .Post-body, [data-test-id="post-content"]' },
          
          // Get all comments
          { name: 'comments', selector: '.comment .usertext-body .md, .Comment-body, [data-testid="comment"]', multiple: true },
          
          // Get comment text specifically
          { name: 'comment_text', selector: '.usertext .md p, .comment-body p', multiple: true },
          
          // Get subreddit
          { name: 'subreddit', selector: '.subreddit, [data-test-id="subreddit-name"]' },
          
          // Get score
          { name: 'score', selector: '.score, .upvotes, [data-test-id="post-vote-score"]' },
          
          // Get all text content as fallback
          { name: 'all_text', selector: 'body' }
        ],
      }),
    });

    if (!response.ok) {
      console.error(`Failed to scrape Reddit thread ${url}:`, response.status);
      return null;
    }

    const data = await response.json();
    
    // Extract and clean content
    const title = data.title || 'No title found';
    const postContent = data.post_content || '';
    
    // Combine all comment content
    const comments = [
      ...(data.comments || []),
      ...(data.comment_text || [])
    ].filter(comment => comment && comment.trim().length > 10)
     .map(comment => comment.trim())
     .slice(0, 50); // Limit to top 50 comments
    
    // Extract subreddit name
    const subredditMatch = url.match(/reddit\.com\/r\/([^\/]+)/) || data.subreddit?.match(/r\/([^\/\s]+)/);
    const subreddit = subredditMatch ? subredditMatch[1] : 'unknown';
    
    // Parse score
    const scoreStr = data.score || '0';
    const score = parseInt(scoreStr.toString().replace(/[^\d-]/g, '')) || 0;
    
    const thread: RedditThread = {
      url: url,
      title: title,
      content: postContent,
      comments: comments,
      subreddit: subreddit,
      score: score,
      timestamp: new Date().toISOString()
    };

    console.log(`Scraped thread "${title}" with ${comments.length} comments from r/${subreddit}`);
    return thread;
    
  } catch (error) {
    console.error(`Error scraping Reddit thread ${url}:`, error);
    return null;
  }
}

function analyzeCustomerVoice(threads: RedditThread[], keywords: string): any {
  const totalThreads = threads.length;
  const totalComments = threads.reduce((sum, thread) => sum + thread.comments.length, 0);
  
  // Combine all text content
  const allContent = threads.map(thread => 
    `${thread.title} ${thread.content} ${thread.comments.join(' ')}`
  ).join(' ').toLowerCase();
  
  console.log(`Analyzing ${allContent.length} characters of Reddit content from ${totalThreads} threads`);
  
  // Analyze emotions and sentiment
  const emotionKeywords = {
    frustration: ['frustrated', 'annoying', 'hate', 'terrible', 'awful', 'disappointed', 'angry', 'mad'],
    satisfaction: ['love', 'great', 'amazing', 'excellent', 'recommend', 'perfect', 'happy', 'satisfied'],
    confusion: ['confused', 'unclear', 'complicated', 'difficult', 'hard to understand', 'dont get it'],
    excitement: ['excited', 'thrilled', 'amazing', 'incredible', 'blown away', 'awesome', 'fantastic'],
    skepticism: ['skeptical', 'doubt', 'suspicious', 'scam', 'fake', 'bullshit', 'not sure'],
    relief: ['relief', 'finally', 'thank god', 'godsend', 'lifesaver', 'game changer']
  };
  
  const emotions = Object.keys(emotionKeywords).reduce((acc, emotion) => {
    const keywords = emotionKeywords[emotion as keyof typeof emotionKeywords];
    acc[emotion] = keywords.reduce((count, keyword) => {
      return count + (allContent.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    return acc;
  }, {} as Record<string, number>);
  
  // Extract customer needs and pain points
  const customerNeeds = extractCustomerNeeds(allContent);
  const painPoints = extractPainPoints(allContent);
  const solutions = extractSolutions(allContent);
  const commonPhrases = extractCommonPhrases(allContent);
  
  // Analyze subreddit distribution
  const subredditCounts = threads.reduce((acc, thread) => {
    acc[thread.subreddit] = (acc[thread.subreddit] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return {
    totalThreads,
    totalComments,
    totalTextLength: allContent.length,
    emotions,
    customerNeeds,
    painPoints,
    solutions,
    commonPhrases,
    subredditDistribution: subredditCounts,
    topSubreddits: Object.entries(subredditCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([subreddit, count]) => ({ subreddit, threadCount: count })),
    averageScore: threads.reduce((sum, thread) => sum + thread.score, 0) / threads.length
  };
}

function extractCustomerNeeds(content: string): string[] {
  const needPatterns = [
    /(?:need|want|looking for|searching for|require|must have|wish|hope for)[\s\w]{10,100}/gi,
    /(?:i need|i want|i'm looking for|i require)[\s\w]{10,80}/gi,
    /(?:help me|can someone|does anyone know)[\s\w]{10,80}/gi
  ];
  
  const needs: string[] = [];
  needPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    needs.push(...matches.slice(0, 10));
  });
  
  return [...new Set(needs)].slice(0, 15);
}

function extractPainPoints(content: string): string[] {
  const painPatterns = [
    /(?:problem|issue|trouble|difficult|hard|annoying|frustrating|struggling|can't|unable to)[\s\w]{10,100}/gi,
    /(?:doesn't work|not working|failed|broken|useless|waste)[\s\w]{10,80}/gi,
    /(?:hate|terrible|awful|worst|disappointed)[\s\w]{10,80}/gi
  ];
  
  const pains: string[] = [];
  painPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    pains.push(...matches.slice(0, 10));
  });
  
  return [...new Set(pains)].slice(0, 15);
}

function extractSolutions(content: string): string[] {
  const solutionPatterns = [
    /(?:solved|fixed|works|helped|improved|better|solution|answer)[\s\w]{10,100}/gi,
    /(?:try|use|get|buy|recommend|suggest)[\s\w]{10,80}/gi,
    /(?:this worked|this helps|this is great)[\s\w]{10,80}/gi
  ];
  
  const solutions: string[] = [];
  solutionPatterns.forEach(pattern => {
    const matches = content.match(pattern) || [];
    solutions.push(...matches.slice(0, 10));
  });
  
  return [...new Set(solutions)].slice(0, 15);
}

function extractCommonPhrases(content: string): string[] {
  const words = content.split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length > 3 && word.length < 20);
    
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, targetKeywords } = await request.json();

    if (!jobId || !targetKeywords) {
      return NextResponse.json({ error: 'Job ID and target keywords are required' }, { status: 400 });
    }

    console.log(`Starting Google + Reddit customer voice collection for job ${jobId} with keywords: ${targetKeywords}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Step 1: Search Google for Reddit threads
    const redditUrls = await searchGoogleForRedditThreads(targetKeywords);
    
    if (redditUrls.length === 0) {
      console.log('No Reddit threads found via Google search');
      await saveJobData(jobId, 'reviews', {
        threads: [],
        analysis: { message: 'No relevant Reddit discussions found via Google search' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Customer voice collection completed (no Reddit discussions found)',
        data: { threadCount: 0, commentCount: 0 }
      });
    }

    // Step 2: Scrape each Reddit thread
    console.log(`Scraping ${redditUrls.length} Reddit threads...`);
    const threads: RedditThread[] = [];
    
    for (const url of redditUrls) {
      const thread = await scrapeRedditThread(url);
      if (thread && (thread.content.length > 50 || thread.comments.length > 0)) {
        threads.push(thread);
      }
    }

    if (threads.length === 0) {
      console.log('No meaningful content extracted from Reddit threads');
      await saveJobData(jobId, 'reviews', {
        threads: [],
        analysis: { message: 'Reddit threads found but no meaningful content extracted' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords, urlsFound: redditUrls.length }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Customer voice collection completed (no meaningful content)',
        data: { threadCount: 0, commentCount: 0 }
      });
    }

    // Step 3: Analyze customer voice
    const voiceAnalysis = analyzeCustomerVoice(threads, targetKeywords);
    
    const reviewsData = {
      threads: threads,
      analysis: voiceAnalysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        googleSearchResults: redditUrls.length,
        successfulScrapes: threads.length,
        dataType: 'reddit_customer_voice'
      }
    };

    await saveJobData(jobId, 'reviews', reviewsData);

    console.log(`Customer voice collection completed for job ${jobId}. Found ${threads.length} threads with ${voiceAnalysis.totalComments} comments.`);

    return NextResponse.json({
      success: true,
      message: 'Customer voice collection completed',
      data: {
        threadCount: threads.length,
        commentCount: voiceAnalysis.totalComments,
        subreddits: voiceAnalysis.topSubreddits.length,
        textLength: voiceAnalysis.totalTextLength,
        emotions: voiceAnalysis.emotions,
        needsFound: voiceAnalysis.customerNeeds.length,
        painPointsFound: voiceAnalysis.painPoints.length
      }
    });

  } catch (error) {
    console.error('Customer voice collection error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Customer voice collection failed', details: errorMessage },
      { status: 500 }
    );
  }
}
