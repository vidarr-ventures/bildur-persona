import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[REDDIT DEBUG] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, testUrl } = body;
    
    const debugResults: any = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: {}
    };
    
    // Test 1: Direct Reddit URL test if provided
    if (testUrl) {
      console.log(`[REDDIT DEBUG] Testing direct URL: ${testUrl}`);
      try {
        const response = await fetch(testUrl, {
          headers: {
            'User-Agent': 'PersonaBot/1.0 (Customer Research Tool)',
          },
        });
        
        debugResults.tests.push({
          test: 'direct_url',
          url: testUrl,
          status: response.status,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          content_preview: response.ok ? (await response.text()).substring(0, 500) : 'No content'
        });
      } catch (error) {
        debugResults.tests.push({
          test: 'direct_url',
          url: testUrl,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Test 2: Reddit JSON API with different approaches
    if (keywords && keywords.length > 0) {
      for (const keyword of keywords) {
        console.log(`[REDDIT DEBUG] Testing keyword: ${keyword}`);
        
        // Test different URL formats
        const testUrls = [
          {
            name: 'reddit_search_json',
            url: `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=5&t=all`
          },
          {
            name: 'reddit_search_json_month',
            url: `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=5&t=month`
          },
          {
            name: 'reddit_search_json_week',
            url: `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=relevance&limit=5&t=week`
          },
          {
            name: 'reddit_search_simple',
            url: `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword.replace(/\s+/g, '+'))}`
          }
        ];
        
        for (const testCase of testUrls) {
          try {
            console.log(`[REDDIT DEBUG] Testing ${testCase.name}: ${testCase.url}`);
            
            const response = await fetch(testCase.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              },
            });
            
            let responseData = null;
            let contentPreview = '';
            
            if (response.ok) {
              try {
                responseData = await response.json();
                contentPreview = JSON.stringify(responseData).substring(0, 200);
                
                // Count results
                const resultCount = responseData?.data?.children?.length || 0;
                console.log(`[REDDIT DEBUG] ${testCase.name} found ${resultCount} results`);
                
              } catch (parseError) {
                contentPreview = 'Failed to parse JSON response';
              }
            } else {
              contentPreview = await response.text();
              contentPreview = contentPreview.substring(0, 200);
            }
            
            debugResults.tests.push({
              keyword,
              test: testCase.name,
              url: testCase.url,
              status: response.status,
              ok: response.ok,
              statusText: response.statusText,
              headers: {
                'content-type': response.headers.get('content-type'),
                'content-length': response.headers.get('content-length'),
                'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
                'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
              },
              result_count: responseData?.data?.children?.length || 0,
              content_preview: contentPreview,
              raw_data: response.ok ? responseData : null
            });
            
          } catch (error) {
            debugResults.tests.push({
              keyword,
              test: testCase.name,
              url: testCase.url,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          
          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    // Test 3: Try specific health-related subreddits
    const healthSubreddits = ['sleep', 'biohacking', 'health', 'alternativehealth', 'Supplements'];
    
    for (const subreddit of healthSubreddits.slice(0, 2)) {
      const keyword = keywords?.[0] || 'grounding';
      const subredditUrl = `https://www.reddit.com/r/${subreddit}.json?limit=5`;
      
      try {
        console.log(`[REDDIT DEBUG] Testing subreddit r/${subreddit}`);
        
        const response = await fetch(subredditUrl, {
          headers: {
            'User-Agent': 'PersonaBot/1.0 (Customer Research Tool)',
          },
        });
        
        let responseData = null;
        if (response.ok) {
          responseData = await response.json();
        }
        
        debugResults.tests.push({
          test: 'subreddit_check',
          subreddit: subreddit,
          url: subredditUrl,
          status: response.status,
          ok: response.ok,
          result_count: responseData?.data?.children?.length || 0,
          sample_titles: responseData?.data?.children?.slice(0, 3)?.map((child: any) => child.data?.title) || []
        });
        
      } catch (error) {
        debugResults.tests.push({
          test: 'subreddit_check',
          subreddit: subreddit,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Generate summary
    debugResults.summary = {
      total_tests: debugResults.tests.length,
      successful_requests: debugResults.tests.filter((t: any) => t.ok === true).length,
      failed_requests: debugResults.tests.filter((t: any) => t.ok === false).length,
      errors: debugResults.tests.filter((t: any) => t.error).length,
      total_results_found: debugResults.tests.reduce((sum: number, t: any) => sum + (t.result_count || 0), 0),
      status_codes: [...new Set(debugResults.tests.map((t: any) => t.status).filter((s: any) => s))]
    };
    
    console.log(`[REDDIT DEBUG] Summary: ${debugResults.summary.successful_requests}/${debugResults.summary.total_tests} successful, ${debugResults.summary.total_results_found} total results`);
    
    return NextResponse.json({
      success: true,
      debug_results: debugResults,
      message: "Reddit debugging completed"
    });
    
  } catch (error) {
    console.error('[REDDIT DEBUG] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Debug failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Reddit Debug Tool - POST with keywords to test Reddit scraping',
    example: {
      keywords: ['grounding sheets', 'earthing'],
      testUrl: 'https://www.reddit.com/r/sleep.json' // Optional direct URL test
    },
    note: 'This endpoint tests various Reddit scraping approaches and provides detailed debugging info'
  });
}