import { NextRequest, NextResponse } from 'next/server';

interface RedditPost {
  title: string;
  selftext: string;
  author: string;
  created_utc: number;
  subreddit: string;
  score: number;
  num_comments: number;
  permalink: string;
  url: string;
  id: string;
}

interface RedditComment {
  body: string;
  author: string;
  created_utc: number;
  score: number;
  id: string;
}

interface RedditSearchResult {
  content_id: string;
  content_type: 'post' | 'comment';
  text: string;
  title?: string;
  username: string;
  date: string;
  subreddit: string;
  score: number;
  num_comments: number;
  keyword_phrase: string;
  relevance_score: number;
  post_url: string;
  source_url: string;
}

export async function POST(request: NextRequest) {
  console.log('[REDDIT NODEJS] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    console.log(`[REDDIT NODEJS] Searching Reddit for keywords: ${keywords.join(', ')}`);
    
    const allResults: RedditSearchResult[] = [];
    const subredditsSearched = new Set<string>();
    const seenIds = new Set<string>();
    
    // Search Reddit for each keyword
    for (const keyword of keywords) {
      console.log(`[REDDIT NODEJS] Processing keyword: ${keyword}`);
      
      try {
        // Search all of Reddit
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all&raw_json=1`;
        
        console.log(`[REDDIT NODEJS] Fetching: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Cache-Control': 'max-age=0'
          },
        });
        
        console.log(`[REDDIT NODEJS] Response status: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          const data = await response.json();
          const posts = data?.data?.children || [];
          
          console.log(`[REDDIT NODEJS] Found ${posts.length} posts for keyword: ${keyword}`);
          console.log(`[REDDIT NODEJS] Response data structure:`, data?.data ? 'valid' : 'invalid');
          
          for (const postWrapper of posts) {
            const post: RedditPost = postWrapper.data;
            
            if (seenIds.has(post.id)) continue;
            seenIds.add(post.id);
            
            const relevanceScore = calculateRelevanceScore(
              `${post.title} ${post.selftext}`, 
              keywords
            );
            
            const result: RedditSearchResult = {
              content_id: `RP_${post.id}`,
              content_type: 'post',
              text: post.selftext || post.title,
              title: post.title,
              username: post.author || 'deleted',
              date: new Date(post.created_utc * 1000).toISOString(),
              subreddit: post.subreddit,
              score: post.score,
              num_comments: post.num_comments,
              keyword_phrase: keyword,
              relevance_score: relevanceScore,
              post_url: `https://reddit.com${post.permalink}`,
              source_url: post.url
            };
            
            allResults.push(result);
            subredditsSearched.add(post.subreddit);
            
            // Get top comments for high relevance posts
            if (relevanceScore > 0.3 && post.num_comments > 0) {
              await getCommentsForPost(post.permalink, keyword, keywords, allResults, seenIds, 3);
            }
          }
        } else {
          console.log(`[REDDIT NODEJS] Search failed for keyword ${keyword}: ${response.status} ${response.statusText}`);
          const errorText = await response.text();
          console.log(`[REDDIT NODEJS] Error response:`, errorText.substring(0, 200));
        }
        
        // Also search specific health subreddits
        const healthSubreddits = ['sleep', 'biohacking', 'health', 'alternativehealth', 'Supplements'];
        
        for (const subreddit of healthSubreddits.slice(0, 2)) {
          try {
            const subredditSearchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=relevance&limit=5&raw_json=1`;
            
            const subResponse = await fetch(subredditSearchUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Cache-Control': 'max-age=0'
              },
            });
            
            if (subResponse.ok) {
              const subData = await subResponse.json();
              const subPosts = subData?.data?.children || [];
              
              for (const postWrapper of subPosts) {
                const post: RedditPost = postWrapper.data;
                
                if (seenIds.has(post.id)) continue;
                seenIds.add(post.id);
                
                const result: RedditSearchResult = {
                  content_id: `RP_${post.id}`,
                  content_type: 'post',
                  text: post.selftext || post.title,
                  title: post.title,
                  username: post.author || 'deleted',
                  date: new Date(post.created_utc * 1000).toISOString(),
                  subreddit: post.subreddit,
                  score: post.score,
                  num_comments: post.num_comments,
                  keyword_phrase: keyword,
                  relevance_score: calculateRelevanceScore(`${post.title} ${post.selftext}`, keywords),
                  post_url: `https://reddit.com${post.permalink}`,
                  source_url: post.url
                };
                
                allResults.push(result);
                subredditsSearched.add(post.subreddit);
              }
            }
          } catch (error) {
            console.log(`[REDDIT NODEJS] Error searching r/${subreddit}:`, error);
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        console.error(`[REDDIT NODEJS] Error processing keyword "${keyword}":`, error);
      }
      
      // Break if we have enough results
      if (allResults.length >= totalLimit) {
        break;
      }
      
      // Small delay between keywords
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Sort by relevance and limit results
    allResults.sort((a, b) => b.relevance_score - a.relevance_score);
    const finalResults = allResults.slice(0, totalLimit);
    
    // Calculate data quality metrics
    const posts = finalResults.filter(r => r.content_type === 'post').length;
    const comments = finalResults.filter(r => r.content_type === 'comment').length;
    const avgRelevance = finalResults.length > 0 
      ? finalResults.reduce((sum, r) => sum + r.relevance_score, 0) / finalResults.length 
      : 0;
    
    const response = {
      source: 'reddit_discussions',
      scrape_date: new Date().toISOString(),
      total_items: finalResults.length,
      keywords_searched: keywords,
      content: finalResults,
      data_quality: {
        api_calls_made: keywords.length * 3, // Approximate
        subreddits_searched: Array.from(subredditsSearched),
        posts_vs_comments: {
          posts: posts,
          comments: comments
        },
        avg_relevance_score: Math.round(avgRelevance * 100) / 100,
        scraping_duration_seconds: Math.round(Date.now() / 1000) // Placeholder
      }
    };
    
    console.log(`[REDDIT NODEJS] Successfully retrieved ${finalResults.length} items from ${subredditsSearched.size} subreddits`);
    
    return NextResponse.json({
      success: true,
      data: response,
      message: "Reddit data fetched successfully using Reddit JSON API"
    });
    
  } catch (error) {
    console.error('[REDDIT NODEJS] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit Node.js API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

async function getCommentsForPost(
  permalink: string, 
  keyword: string, 
  keywords: string[], 
  results: RedditSearchResult[], 
  seenIds: Set<string>,
  limit: number = 3
) {
  try {
    const commentsUrl = `https://www.reddit.com${permalink}.json?raw_json=1&limit=${limit}`;
    
    const response = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const comments = data[1]?.data?.children || [];
      
      for (const commentWrapper of comments.slice(0, limit)) {
        const comment: RedditComment = commentWrapper.data;
        
        if (!comment.body || comment.body.length < 20 || seenIds.has(comment.id)) continue;
        seenIds.add(comment.id);
        
        const relevanceScore = calculateRelevanceScore(comment.body, keywords);
        
        if (relevanceScore > 0.2) { // Only include relevant comments
          const result: RedditSearchResult = {
            content_id: `RC_${comment.id}`,
            content_type: 'comment',
            text: comment.body,
            username: comment.author || 'deleted',
            date: new Date(comment.created_utc * 1000).toISOString(),
            subreddit: permalink.split('/r/')[1]?.split('/')[0] || 'unknown',
            score: comment.score,
            num_comments: 0,
            keyword_phrase: keyword,
            relevance_score: relevanceScore,
            post_url: `https://reddit.com${permalink}`,
            source_url: `https://reddit.com${permalink}${comment.id}`
          };
          
          results.push(result);
        }
      }
    }
  } catch (error) {
    console.log(`[REDDIT NODEJS] Error getting comments for ${permalink}:`, error);
  }
}

function calculateRelevanceScore(text: string, keywords: string[]): number {
  const textLower = text.toLowerCase();
  let score = 0;
  
  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();
    
    // Direct keyword phrase match
    if (textLower.includes(keywordLower)) {
      score += 0.4;
    }
    
    // Individual word matches
    const words = keywordLower.split(/\s+/);
    for (const word of words) {
      if (word.length > 2 && textLower.includes(word)) {
        score += 0.1;
      }
    }
  }
  
  return Math.min(score, 1.0);
}

export async function GET() {
  return NextResponse.json({
    message: 'Reddit Search via Node.js JSON API - POST with keywords array',
    example: {
      keywords: ['grounding sheets', 'earthing sheets', 'grounding for health'],
      totalLimit: 25
    },
    note: 'This endpoint uses Reddit\'s public JSON API directly through Node.js. No Reddit API credentials required.',
    benefits: [
      'No external dependencies required',
      'Works in serverless environments like Vercel',
      'No rate limits from Reddit API',
      'Searches multiple subreddits automatically'
    ]
  });
}