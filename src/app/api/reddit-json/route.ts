import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[REDDIT JSON] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    console.log(`[REDDIT JSON] Searching Reddit for keywords: ${keywords.join(', ')}`);
    
    const allResults: any[] = [];
    const subredditsSearched = new Set<string>();
    const contentPerKeyword: Record<string, number> = {};
    
    // Search Reddit using their public JSON API (no auth required)
    for (const keyword of keywords) {
      try {
        // Search across all of Reddit - use 'all' time period for more results
        const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=10&t=all`;
        console.log(`[REDDIT JSON] Fetching: ${searchUrl}`);
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`[REDDIT JSON] Found ${data.data?.children?.length || 0} posts for: ${keyword}`);
          
          // Parse Reddit JSON response
          if (data.data && data.data.children) {
            const items = data.data.children.map((child: any) => {
              const post = child.data;
              const subreddit = post.subreddit || 'unknown';
              subredditsSearched.add(subreddit);
              
              return {
                content_id: post.id,
                type: 'post',
                title: post.title,
                text: post.selftext || post.title,
                keyword_phrase: keyword,
                relevance_score: calculateRelevanceFromReddit(post, keyword),
                date: new Date(post.created_utc * 1000).toISOString(),
                subreddit: subreddit,
                score: post.score || 0,
                num_comments: post.num_comments || 0,
                author: post.author,
                url: `https://reddit.com${post.permalink}`,
                is_self: post.is_self,
                upvote_ratio: post.upvote_ratio,
              };
            });
            
            allResults.push(...items);
            contentPerKeyword[keyword] = items.length;
          }
        } else {
          console.log(`[REDDIT JSON] Failed to fetch Reddit data: ${response.status}`);
          contentPerKeyword[keyword] = 0;
        }
      } catch (error) {
        console.error(`[REDDIT JSON] Error searching for "${keyword}":`, error);
        contentPerKeyword[keyword] = 0;
      }
      
      // Respectful delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Also search specific relevant subreddits (health-focused for grounding/earthing)
    const relevantSubreddits = ['sleep', 'biohacking', 'health', 'Earthing', 'alternativehealth', 'Supplements'];
    for (const subreddit of relevantSubreddits.slice(0, 2)) {
      for (const keyword of keywords.slice(0, 1)) {
        try {
          const subredditUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=on&sort=relevance&limit=5&t=all`;
          console.log(`[REDDIT JSON] Searching r/${subreddit} for: ${keyword}`);
          
          const response = await fetch(subredditUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.data && data.data.children) {
              const items = data.data.children.map((child: any) => {
                const post = child.data;
                
                return {
                  content_id: post.id,
                  type: 'post',
                  title: post.title,
                  text: post.selftext || post.title,
                  keyword_phrase: keyword,
                  relevance_score: calculateRelevanceFromReddit(post, keyword),
                  date: new Date(post.created_utc * 1000).toISOString(),
                  subreddit: subreddit,
                  score: post.score || 0,
                  num_comments: post.num_comments || 0,
                  author: post.author,
                  url: `https://reddit.com${post.permalink}`,
                  is_self: post.is_self,
                  upvote_ratio: post.upvote_ratio,
                };
              });
              
              allResults.push(...items);
              subredditsSearched.add(subreddit);
              console.log(`[REDDIT JSON] Found ${items.length} posts in r/${subreddit}`);
            }
          }
        } catch (error) {
          console.error(`[REDDIT JSON] Error searching r/${subreddit}:`, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Fetch comments for top posts (to get more discussion content)
    const topPosts = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    for (const post of topPosts) {
      try {
        const commentsUrl = `https://www.reddit.com/comments/${post.content_id}.json?limit=5&sort=top`;
        console.log(`[REDDIT JSON] Fetching comments for post: ${post.content_id}`);
        
        const response = await fetch(commentsUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          
          // Reddit returns an array, comments are in the second element
          if (data && data[1] && data[1].data && data[1].data.children) {
            const comments = data[1].data.children
              .filter((child: any) => child.kind === 't1') // t1 = comment
              .map((child: any) => {
                const comment = child.data;
                
                return {
                  content_id: comment.id,
                  type: 'comment',
                  title: null,
                  text: comment.body,
                  keyword_phrase: post.keyword_phrase,
                  relevance_score: 0.7,
                  date: new Date(comment.created_utc * 1000).toISOString(),
                  subreddit: post.subreddit,
                  score: comment.score || 0,
                  num_comments: 0,
                  author: comment.author,
                  url: `https://reddit.com${comment.permalink}`,
                  parent_post: post.content_id,
                };
              });
            
            allResults.push(...comments);
            console.log(`[REDDIT JSON] Added ${comments.length} comments from post`);
          }
        }
      } catch (error) {
        console.error(`[REDDIT JSON] Error fetching comments:`, error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Limit and sort results
    const finalResults = allResults
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, totalLimit);
    
    // Calculate metrics
    const totalPosts = finalResults.filter(r => r.type === 'post').length;
    const totalComments = finalResults.filter(r => r.type === 'comment').length;
    const avgScore = finalResults.length > 0 
      ? finalResults.reduce((sum, r) => sum + r.score, 0) / finalResults.length 
      : 0;

    console.log(`[REDDIT JSON] Total results: ${finalResults.length}`);
    console.log(`[REDDIT JSON] Posts: ${totalPosts}, Comments: ${totalComments}`);

    return NextResponse.json({
      success: true,
      data: {
        source: "reddit_json_api",
        scrape_date: new Date().toISOString(),
        total_items: finalResults.length,
        keywords_searched: keywords,
        content: finalResults,
        data_quality: {
          subreddits_searched: Array.from(subredditsSearched),
          content_per_keyword: contentPerKeyword,
          posts_vs_comments: {
            posts: totalPosts,
            comments: totalComments
          },
          avg_score: Math.round(avgScore),
          method: 'reddit_public_json_api'
        }
      },
      message: "Live Reddit data fetched using Reddit's public JSON API (no authentication required)"
    });

  } catch (error) {
    console.error('[REDDIT JSON] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit JSON API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

// Calculate relevance score from Reddit post data
function calculateRelevanceFromReddit(post: any, keyword: string): number {
  let score = 0.5; // Base score
  
  const lowerKeyword = keyword.toLowerCase();
  const title = (post.title || '').toLowerCase();
  const text = (post.selftext || '').toLowerCase();
  
  // Direct keyword match in title
  if (title.includes(lowerKeyword)) {
    score += 0.3;
  }
  
  // Direct keyword match in text
  if (text.includes(lowerKeyword)) {
    score += 0.2;
  }
  
  // Individual word matches
  const words = lowerKeyword.split(' ');
  words.forEach(word => {
    if (title.includes(word)) score += 0.05;
    if (text.includes(word)) score += 0.05;
  });
  
  // Engagement score (normalized)
  if (post.score > 100) score += 0.1;
  if (post.num_comments > 20) score += 0.1;
  
  return Math.min(score, 1.0);
}

export async function GET() {
  return NextResponse.json({
    message: 'Reddit Live Search via JSON API - POST with keywords array to search Reddit discussions',
    example: {
      keywords: ['customer service problems', 'software frustrations', 'small business challenges'],
      totalLimit: 25
    },
    note: 'This endpoint uses Reddit\'s public JSON API - no authentication required, returns REAL Reddit data'
  });
}