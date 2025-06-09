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

async function searchRedditJSON(keywords: string): Promise<RedditThread[]> {
  try {
    console.log(`Searching Reddit JSON API for: ${keywords}`);
    
    // Search relevant subreddits using Reddit's JSON API
    const subreddits = [
      'Earthing', 'sleep', 'insomnia', 'biohacking', 'health', 'wellness',
      'naturalhealth', 'alternative_health', 'sleeptips', 'BuyItForLife'
    ];
    
    const allThreads: RedditThread[] = [];
    
    for (const subreddit of subreddits.slice(0, 6)) { // Limit to 6 subreddits
      try {
        console.log(`Searching r/${subreddit} via JSON API`);
        
        // Use Reddit's JSON search endpoint
        const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'PersonaBot/1.0 (by /u/researcher)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.data && data.data.children) {
            for (const post of data.data.children) {
              const postData = post.data;
              
              // Get the thread details
              const thread = await getRedditThreadJSON(postData.permalink, postData);
              if (thread) {
                allThreads.push(thread);
              }
            }
          }
        } else {
          console.log(`Failed to search r/${subreddit}: ${response.status}`);
        }
      } catch (error) {
        console.error(`Error searching r/${subreddit}:`, error);
      }
    }
    
    // Also search Reddit's general search
    try {
      console.log('Searching Reddit general search');
      const generalSearchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keywords)}&sort=relevance&limit=20`;
      
      const response = await fetch(generalSearchUrl, {
        headers: {
          'User-Agent': 'PersonaBot/1.0 (by /u/researcher)'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.data && data.data.children) {
          for (const post of data.data.children.slice(0, 10)) {
            const postData = post.data;
            
            const thread = await getRedditThreadJSON(postData.permalink, postData);
            if (thread) {
              allThreads.push(thread);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error with general Reddit search:', error);
    }
    
    // Remove duplicates and return
    const uniqueThreads = allThreads.filter((thread, index, array) => 
      array.findIndex(t => t.url === thread.url) === index
    );
    
    console.log(`Found ${uniqueThreads.length} unique Reddit threads via JSON API`);
    return uniqueThreads.slice(0, 15); // Limit to top 15 threads
    
  } catch (error) {
    console.error('Error searching Reddit JSON:', error);
    return [];
  }
}

async function getRedditThreadJSON(permalink: string, postData: any): Promise<RedditThread | null> {
  try {
    // Get thread with comments using Reddit's JSON API
    const threadUrl = `https://www.reddit.com${permalink}.json?limit=50`;
    
    const response = await fetch(threadUrl, {
      headers: {
        'User-Agent': 'PersonaBot/1.0 (by /u/researcher)'
      }
    });

    if (!response.ok) {
      console.log(`Failed to get thread ${permalink}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    if (!data || !Array.isArray(data) || data.length < 2) {
      return null;
    }

    // Extract post content
    const post = data[0].data.children[0].data;
    const title = post.title || 'No title';
    const content = post.selftext || '';
    const subreddit = post.subreddit || 'unknown';
    const score = post.score || 0;
    
    // Extract comments
    const comments: string[] = [];
    const commentsData = data[1].data.children;
    
    function extractComments(commentList: any[], depth = 0) {
      if (depth > 3) return; // Limit comment depth
      
      for (const comment of commentList) {
        if (comment.kind === 't1' && comment.data.body) {
          const commentText = comment.data.body.trim();
          if (commentText.length > 10 && !commentText.includes('[deleted]') && !commentText.includes('[removed]')) {
            comments.push(commentText);
          }
          
          // Process replies
          if (comment.data.replies && comment.data.replies.data && comment.data.replies.data.children) {
            extractComments(comment.data.replies.data.children, depth + 1);
          }
        }
      }
    }
    
    extractComments(commentsData);
    
    const thread: RedditThread = {
      url: `https://www.reddit.com${permalink}`,
      title: title,
      content: content,
      comments: comments.slice(0, 100), // Limit to 100 comments
      subreddit: subreddit,
      score: score,
      timestamp: new Date(post.created_utc * 1000).toISOString()
    };

    console.log(`Extracted thread "${title.substring(0, 50)}..." with ${comments.length} comments from r/${subreddit}`);
    return thread;
    
  } catch (error) {
    console.error(`Error getting Reddit thread ${permalink}:`, error);
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
  
  // Extract customer insights
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
    averageScore: threads.length > 0 ? threads.reduce((sum, thread) => sum + thread.score, 0) / threads.length : 0
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

    console.log(`Starting Reddit JSON API customer voice collection for job ${jobId} with keywords: ${targetKeywords}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Search Reddit using JSON API
    const threads = await searchRedditJSON(targetKeywords);
    
    if (threads.length === 0) {
      console.log('No Reddit threads found via JSON API');
      await saveJobData(jobId, 'reviews', {
        threads: [],
        analysis: { message: 'No relevant Reddit discussions found via JSON API' },
        metadata: { timestamp: new Date().toISOString(), keywords: targetKeywords }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Customer voice collection completed (no Reddit discussions found)',
        data: { threadCount: 0, commentCount: 0 }
      });
    }

    // Analyze customer voice
    const voiceAnalysis = analyzeCustomerVoice(threads, targetKeywords);
    
    const reviewsData = {
      threads: threads,
      analysis: voiceAnalysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        successfulScrapes: threads.length,
        dataType: 'reddit_json_api'
      }
    };

    await saveJobData(jobId, 'reviews', reviewsData);

    console.log(`Reddit JSON API customer voice collection completed for job ${jobId}. Found ${threads.length} threads with ${voiceAnalysis.totalComments} comments.`);

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
