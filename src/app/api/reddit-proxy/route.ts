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

// Multiple proxy endpoints for redundancy
const PROXY_ENDPOINTS = [
  'https://api.proxyscrape.com/v2/?request=get&protocol=http&timeout=10000&country=us&ssl=all&anonymity=all&format=textplain',
  'https://www.proxy-list.download/api/v1/get?type=http&anon=elite&country=US',
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt'
];

// Fallback to direct Reddit API services that may not be blocked
const REDDIT_API_ALTERNATIVES = [
  'https://www.reddit.com',
  'https://old.reddit.com',
  'https://api.reddit.com',
  'https://oauth.reddit.com'
];

export async function POST(request: NextRequest) {
  console.log('[REDDIT PROXY] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    console.log(`[REDDIT PROXY] Searching Reddit for keywords: ${keywords.join(', ')}`);
    
    const allResults: RedditSearchResult[] = [];
    const subredditsSearched = new Set<string>();
    const seenIds = new Set<string>();
    
    // Try multiple approaches to bypass blocking
    const approaches = [
      { name: 'cors-proxy', url: 'https://api.allorigins.win/get?url=' },
      { name: 'cors-anywhere', url: 'https://cors-anywhere.herokuapp.com/' },
      { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' },
      { name: 'direct-old-reddit', url: '' }
    ];
    
    for (const keyword of keywords) {
      console.log(`[REDDIT PROXY] Processing keyword: ${keyword}`);
      
      let success = false;
      
      // Try each approach until one works
      for (const approach of approaches) {
        if (success) break;
        
        try {
          console.log(`[REDDIT PROXY] Trying ${approach.name} for keyword: ${keyword}`);
          
          let searchUrl;
          let fetchUrl;
          
          if (approach.name === 'direct-old-reddit') {
            // Try old Reddit interface
            searchUrl = `https://old.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all&raw_json=1`;
            fetchUrl = searchUrl;
          } else if (approach.name === 'cors-proxy' && approach.url.includes('allorigins')) {
            searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all&raw_json=1`;
            fetchUrl = `${approach.url}${encodeURIComponent(searchUrl)}`;
          } else {
            searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all&raw_json=1`;
            fetchUrl = `${approach.url}${searchUrl}`;
          }
          
          console.log(`[REDDIT PROXY] Fetching via ${approach.name}: ${fetchUrl}`);
          
          const response = await fetch(fetchUrl, {
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.reddit.com/',
              'Origin': 'https://www.reddit.com',
              'X-Requested-With': 'XMLHttpRequest'
            },
            timeout: 10000
          });
          
          console.log(`[REDDIT PROXY] Response status from ${approach.name}: ${response.status}`);
          
          if (response.ok) {
            let data;
            const responseText = await response.text();
            
            // Handle different proxy response formats
            if (approach.name === 'cors-proxy' && approach.url.includes('allorigins')) {
              const proxyResponse = JSON.parse(responseText);
              if (proxyResponse.status?.http_code === 200) {
                data = JSON.parse(proxyResponse.contents);
              } else {
                throw new Error(`Proxy returned HTTP ${proxyResponse.status?.http_code}`);
              }
            } else {
              data = JSON.parse(responseText);
            }
            
            const posts = data?.data?.children || [];
            console.log(`[REDDIT PROXY] Found ${posts.length} posts via ${approach.name} for keyword: ${keyword}`);
            
            if (posts.length > 0) {
              success = true;
              
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
              
              console.log(`[REDDIT PROXY] Successfully scraped ${posts.length} posts via ${approach.name}`);
              break; // Success, no need to try other approaches for this keyword
            }
          }
          
        } catch (error) {
          console.log(`[REDDIT PROXY] ${approach.name} failed for keyword "${keyword}":`, error instanceof Error ? error.message : String(error));
          continue; // Try next approach
        }
        
        // Small delay between approaches
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (!success) {
        console.log(`[REDDIT PROXY] All approaches failed for keyword: ${keyword}`);
      }
      
      // Break if we have enough results
      if (allResults.length >= totalLimit) {
        break;
      }
      
      // Delay between keywords
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
        api_calls_made: keywords.length * approaches.length,
        subreddits_searched: Array.from(subredditsSearched),
        posts_vs_comments: {
          posts: posts,
          comments: comments
        },
        avg_relevance_score: Math.round(avgRelevance * 100) / 100,
        scraping_duration_seconds: Math.round(Date.now() / 1000)
      }
    };
    
    console.log(`[REDDIT PROXY] Successfully retrieved ${finalResults.length} items from ${subredditsSearched.size} subreddits`);
    
    return NextResponse.json({
      success: true,
      data: response,
      message: `Reddit data fetched successfully via proxy (${finalResults.length} results found)`
    });
    
  } catch (error) {
    console.error('[REDDIT PROXY] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit proxy API request failed',
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
    message: 'Reddit Search via Multiple Proxy Methods - POST with keywords array',
    example: {
      keywords: ['grounding sheets', 'earthing sheets', 'grounding for health'],
      totalLimit: 25
    },
    note: 'This endpoint uses multiple proxy services and fallback methods to bypass Reddit IP blocking.',
    methods: [
      'CORS proxy services (allorigins.win)',
      'Alternative CORS proxies (cors-anywhere)',
      'Third-party proxy services (thingproxy)',
      'Old Reddit interface fallback',
      'Multiple retry mechanisms with different approaches'
    ]
  });
}