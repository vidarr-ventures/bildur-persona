import { NextRequest, NextResponse } from 'next/server';

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

// Use public proxy services that can access Reddit
const WORKING_PROXIES = [
  // These are public CORS proxies that might work
  'https://corsproxy.io/?',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://jsonp.afeld.me/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://yacdn.org/proxy/',
  'https://cors.bridged.cc/',
  'https://cors-proxy.htmldriven.com/?url=',
];

export async function POST(request: NextRequest) {
  console.log('[REDDIT REAL PROXY] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    console.log(`[REDDIT REAL PROXY] Searching Reddit for keywords: ${keywords.join(', ')}`);
    
    const allResults: RedditSearchResult[] = [];
    const subredditsSearched = new Set<string>();
    const seenIds = new Set<string>();
    
    // Try different Reddit endpoints and proxies
    const redditEndpoints = [
      'https://www.reddit.com',
      'https://old.reddit.com',
      'https://api.reddit.com',
      'https://gateway.reddit.com',
      'https://oauth.reddit.com'
    ];
    
    for (const keyword of keywords) {
      console.log(`[REDDIT REAL PROXY] Processing keyword: ${keyword}`);
      
      let success = false;
      
      // Try each proxy service
      for (const proxy of WORKING_PROXIES) {
        if (success) break;
        
        // Try each Reddit endpoint
        for (const redditBase of redditEndpoints) {
          if (success) break;
          
          try {
            const searchUrl = `${redditBase}/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all&raw_json=1`;
            const proxyUrl = `${proxy}${encodeURIComponent(searchUrl)}`;
            
            console.log(`[REDDIT REAL PROXY] Trying: ${proxy} with ${redditBase}`);
            
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            
            const response = await fetch(proxyUrl, {
              method: 'GET',
              headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
              signal: controller.signal
            }).catch(err => {
              console.log(`[REDDIT REAL PROXY] Fetch error: ${err.message}`);
              return null;
            });
            
            clearTimeout(timeout);
            
            if (!response) continue;
            
            console.log(`[REDDIT REAL PROXY] Response status: ${response.status}`);
            
            if (response.ok) {
              try {
                const text = await response.text();
                const data = JSON.parse(text);
                
                if (data && data.data && data.data.children) {
                  const posts = data.data.children;
                  console.log(`[REDDIT REAL PROXY] SUCCESS! Found ${posts.length} posts via ${proxy}`);
                  
                  for (const postWrapper of posts) {
                    const post = postWrapper.data;
                    
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
                  }
                  
                  success = true;
                  console.log(`[REDDIT REAL PROXY] Successfully retrieved ${posts.length} real posts`);
                  break;
                }
              } catch (parseError) {
                console.log(`[REDDIT REAL PROXY] Parse error: ${parseError}`);
              }
            }
          } catch (error) {
            console.log(`[REDDIT REAL PROXY] Error with ${proxy}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      
      if (!success) {
        console.log(`[REDDIT REAL PROXY] All proxies failed for keyword: ${keyword}`);
        
        // Last resort: Try using a different approach - scrape Google cache of Reddit
        try {
          const googleCacheUrl = `https://webcache.googleusercontent.com/search?q=cache:reddit.com/search?q=${encodeURIComponent(keyword)}`;
          console.log(`[REDDIT REAL PROXY] Trying Google cache as last resort`);
          
          const response = await fetch(googleCacheUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            }
          }).catch(err => null);
          
          if (response && response.ok) {
            console.log(`[REDDIT REAL PROXY] Google cache responded`);
          }
        } catch (error) {
          console.log(`[REDDIT REAL PROXY] Google cache also failed`);
        }
      }
      
      // Break if we have enough results
      if (allResults.length >= totalLimit) {
        break;
      }
      
      // Small delay between keywords
      await new Promise(resolve => setTimeout(resolve, 500));
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
        api_calls_made: keywords.length * WORKING_PROXIES.length,
        subreddits_searched: Array.from(subredditsSearched),
        posts_vs_comments: {
          posts: posts,
          comments: comments
        },
        avg_relevance_score: Math.round(avgRelevance * 100) / 100,
        scraping_duration_seconds: Math.round(Date.now() / 1000)
      }
    };
    
    console.log(`[REDDIT REAL PROXY] Final result: ${finalResults.length} real Reddit posts from ${subredditsSearched.size} subreddits`);
    
    return NextResponse.json({
      success: true,
      data: response,
      message: finalResults.length > 0 
        ? `Successfully retrieved ${finalResults.length} real Reddit posts`
        : `No results found. Reddit and proxy services may be blocking requests.`
    });
    
  } catch (error) {
    console.error('[REDDIT REAL PROXY] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit real proxy API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
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
    message: 'Reddit Search via Multiple Real Proxy Services - POST with keywords array',
    example: {
      keywords: ['grounding sheets', 'earthing sheets', 'grounding for health'],
      totalLimit: 25
    },
    note: 'This endpoint attempts to use real proxy services to access actual Reddit data.',
    proxies: WORKING_PROXIES,
    status: 'Attempting to bypass Reddit blocking with multiple proxy approaches'
  });
}