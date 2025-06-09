// src/app/api/workers/reviews-collector/route.ts
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

async function searchRedditDirectly(keywords: string): Promise<RedditThread[]> {
  try {
    console.log(`Starting direct Reddit search for: ${keywords}`);
    
    const allThreads: RedditThread[] = [];
    
    // Test URLs that work (based on your debug results)
    const searchUrls = [
      `https://www.reddit.com/search.json?q=${encodeURIComponent(keywords)}&sort=relevance&limit=25`,
      `https://www.reddit.com/r/sleep/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`,
      `https://www.reddit.com/r/Earthing/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`,
      `https://www.reddit.com/r/insomnia/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`
    ];
    
    for (const searchUrl of searchUrls) {
      try {
        console.log(`Searching: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'PersonaBot/1.0 (Research purposes)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Response received, processing data...`);
          
          if (data?.data?.children) {
            console.log(`Found ${data.data.children.length} posts in this search`);
            
            for (const post of data.data.children.slice(0, 5)) { // Limit per search
              if (post?.data) {
                const thread = await processRedditPost(post.data);
                if (thread) {
                  allThreads.push(thread);
                }
              }
            }
          }
        } else {
          console.log(`Search failed with status: ${response.status}`);
        }
        
        // Rate limiting delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error with search URL ${searchUrl}:`, error);
      }
    }
    
    // Remove duplicates
    const uniqueThreads = allThreads.filter((thread, index, array) => 
      array.findIndex(t => t.url === thread.url) === index
    );
    
    console.log(`Total unique threads found: ${uniqueThreads.length}`);
    return uniqueThreads;
    
  } catch (error) {
    console.error('Error in searchRedditDirectly:', error);
    return [];
  }
}

async function processRedditPost(postData: any): Promise<RedditThread | null> {
  try {
    const title = postData.title || '';
    const content = postData.selftext || '';
    const permalink = postData.permalink || '';
    const subreddit = postData.subreddit || 'unknown';
    const score = postData.score || 0;
    const created = postData.created_utc || 0;
    
    if (!title || !permalink) {
      return null;
    }
    
    console.log(`Processing post: "${title.substring(0, 50)}..."`);
    
    // Get comments for this post
    const comments = await getPostComments(permalink);
    
    const thread: RedditThread = {
      url: `https://www.reddit.com${permalink}`,
      title: title,
      content: content,
      comments: comments,
      subreddit: subreddit,
      score: score,
      timestamp: new Date(created * 1000).toISOString()
    };
    
    console.log(`Created thread with ${comments.length} comments`);
    return thread;
    
  } catch (error) {
    console.error('Error processing Reddit post:', error);
    return null;
  }
}

async function getPostComments(permalink: string): Promise<string[]> {
  try {
    const commentsUrl = `https://www.reddit.com${permalink}.json?limit=50`;
    
    const response = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'PersonaBot/1.0 (Research purposes)'
      }
    });

    if (!response.ok) {
      console.log(`Failed to get comments for ${permalink}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    
    if (!Array.isArray(data) || data.length < 2) {
      return [];
    }

    const comments: string[] = [];
    const commentsData = data[1]?.data?.children || [];
    
    function extractComments(commentList: any[], depth = 0) {
      if (depth > 2 || comments.length > 50) return; // Limit depth and total
      
      for (const comment of commentList) {
        if (comment?.kind === 't1' && comment?.data?.body) {
          const commentText = comment.data.body.trim();
          if (commentText.length > 20 && 
              !commentText.includes('[deleted]') && 
              !commentText.includes('[removed]') &&
              !commentText.startsWith('AutoModerator')) {
            comments.push(commentText);
          }
          
          // Process replies
          if (comment.data.replies?.data?.children && depth < 2) {
            extractComments(comment.data.replies.data.children, depth + 1);
          }
        }
      }
    }
    
    extractComments(commentsData);
    console.log(`Extracted ${comments.length} comments from ${permalink}`);
    return comments;
    
  } catch (error) {
    console.error(`Error getting comments for ${permalink}:`, error);
    return [];
  }
}

function analyzeCustomerVoice(threads: RedditThread[], keywords: string): any {
  const totalThreads = threads.length;
  const totalComments = threads.reduce((sum, thread) => sum + thread.comments.length, 0);
  
  // Combine all text for analysis
  const allText = threads.map(thread => 
    `${thread.title} ${thread.content} ${thread.comments.join(' ')}`
  ).join(' ').toLowerCase();
  
  // Simple sentiment analysis
  const positiveWords = ['great', 'amazing', 'love', 'excellent', 'recommend', 'perfect', 'happy', 'satisfied', 'works', 'helped'];
  const negativeWords = ['terrible', 'awful', 'hate', 'disappointed', 'frustrated', 'useless', 'waste', 'broken', 'failed'];
  
  const positiveCount = positiveWords.reduce((count, word) => 
    count + (allText.match(new RegExp(word, 'g')) || []).length, 0);
  const negativeCount = negativeWords.reduce((count, word) => 
    count + (allText.match(new RegExp(word, 'g')) || []).length, 0);
  
  // Extract customer voice snippets
  const customerVoice = threads.flatMap(thread => [
    thread.title,
    ...thread.comments.slice(0, 3)
  ]).filter(text => text.length > 30).slice(0, 20);
  
  return {
    totalThreads,
    totalComments,
    totalTextLength: allText.length,
    sentiment: {
      positive: positiveCount,
      negative: negativeCount,
      ratio: positiveCount > 0 ? (positiveCount / (positiveCount + negativeCount)) : 0
    },
    customerVoiceData: customerVoice,
    topSubreddits: [...new Set(threads.map(t => t.subreddit))].slice(0, 5),
    averageScore: threads.length > 0 ? Math.round(threads.reduce((sum, t) => sum + t.score, 0) / threads.length) : 0
  };
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, targetKeywords } = await request.json();

    if (!jobId || !targetKeywords) {
      return NextResponse.json({ 
        error: 'Job ID and target keywords are required' 
      }, { status: 400 });
    }

    console.log(`Starting direct Reddit search for job ${jobId} with keywords: ${targetKeywords}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Search Reddit directly (no ScrapeOwl)
    const threads = await searchRedditDirectly(targetKeywords);
    
    if (threads.length === 0) {
      console.log('No Reddit threads found');
      await saveJobData(jobId, 'reviews', {
        threads: [],
        analysis: { message: 'No relevant Reddit discussions found' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Customer voice collection completed (no Reddit discussions found)',
        data: { threadCount: 0, commentCount: 0 }
      });
    }

    // Analyze the customer voice data
    const analysis = analyzeCustomerVoice(threads, targetKeywords);
    
    const reviewsData = {
      threads: threads,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        successfulScrapes: threads.length,
        dataType: 'reddit_direct_api'
      }
    };

    await saveJobData(jobId, 'reviews', reviewsData);

    console.log(`Reddit search completed for job ${jobId}. Found ${threads.length} threads with ${analysis.totalComments} comments.`);

    return NextResponse.json({
      success: true,
      message: 'Customer voice collection completed successfully',
      data: {
        threadCount: threads.length,
        commentCount: analysis.totalComments,
        textLength: analysis.totalTextLength,
        sentiment: analysis.sentiment,
        topSubreddits: analysis.topSubreddits,
        customerVoiceData: analysis.customerVoiceData.slice(0, 5) // Preview
      }
    });

  } catch (error) {
    console.error('Reddit worker error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Customer voice collection failed', details: errorMessage },
      { status: 500 }
    );
  }
}
