import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const keywords = 'grounding sheets';
    
    // Test the exact same search URLs our worker uses
    const testUrls = [
      `https://old.reddit.com/r/Earthing/search?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&t=all`,
      `https://old.reddit.com/search?q=${encodeURIComponent(keywords)}&sort=relevance&t=all`,
      `https://old.reddit.com/r/sleep/search?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&t=all`
    ];
    
    const results = [];
    
    for (const searchUrl of testUrls) {
      try {
        console.log('Testing Reddit search URL:', searchUrl);
        
        const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: process.env.SCRAPEOWL_API_KEY,
            url: searchUrl,
            render_js: false,
            elements: [
              { name: 'thread_links', selector: 'a[href*="/comments/"]', multiple: true, attribute: 'href' },
              { name: 'post_titles', selector: '.search-result-link', multiple: true },
              { name: 'result_links', selector: '.search-result .entry a', multiple: true, attribute: 'href' },
              { name: 'all_links', selector: 'a', multiple: true, attribute: 'href' },
              { name: 'page_text', selector: 'body' }
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          
          // Filter for actual Reddit thread URLs
          const threadLinks = (data.thread_links || []).filter((link: string) => 
            link && link.includes('/comments/')
          );
          
          results.push({
            url: searchUrl,
            status: 'success',
            threadLinksFound: threadLinks.length,
            threadLinks: threadLinks.slice(0, 5),
            postTitles: (data.post_titles || []).slice(0, 5),
            allLinksCount: (data.all_links || []).length,
            pageTextSample: (data.page_text || '').substring(0, 500),
            rawData: {
              thread_links: data.thread_links || [],
              result_links: data.result_links || [],
              post_titles: data.post_titles || []
            }
          });
        } else {
          const errorText = await response.text();
          results.push({
            url: searchUrl,
            status: 'error',
            error: errorText
          });
        }
      } catch (error) {
        results.push({
          url: searchUrl,
          status: 'exception',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      keywords: keywords,
      testResults: results,
      summary: {
        totalUrlsTested: testUrls.length,
        successfulRequests: results.filter(r => r.status === 'success').length,
        totalThreadsFound: results.reduce((sum, r) => sum + (r.threadLinksFound || 0), 0)
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Debug Reddit search failed',
      details: errorMessage
    }, { status: 500 });
  }
}
