import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const keywords = 'grounding sheets';
    const googleQuery = `site:reddit.com "${keywords}"`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}&num=20`;
    
    console.log('Testing Google search URL:', searchUrl);
    
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
          // Try different selectors for Google results
          { name: 'all_links', selector: 'a', multiple: true, attribute: 'href' },
          { name: 'result_links', selector: 'a[href*="reddit.com"]', multiple: true, attribute: 'href' },
          { name: 'search_results', selector: 'div[data-ved] a', multiple: true, attribute: 'href' },
          { name: 'reddit_links', selector: 'a[href*="reddit.com/r/"]', multiple: true, attribute: 'href' },
          { name: 'page_text', selector: 'body' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: 'Google search failed',
        status: response.status,
        details: errorText,
        searchUrl: searchUrl
      });
    }

    const data = await response.json();
    
    // Filter and clean Reddit URLs
    const allLinks = data.all_links || [];
    const redditLinks = allLinks.filter((url: string) => 
      url && url.includes('reddit.com/r/') && url.includes('/comments/')
    );
    
    return NextResponse.json({
      success: true,
      searchUrl: searchUrl,
      googleQuery: googleQuery,
      totalLinksFound: allLinks.length,
      redditLinksFound: redditLinks.length,
      redditUrls: redditLinks.slice(0, 10),
      rawData: {
        all_links: (data.all_links || []).slice(0, 20),
        result_links: data.result_links || [],
        search_results: data.search_results || [],
        reddit_links: data.reddit_links || []
      },
      pageTextSample: (data.page_text || '').substring(0, 500)
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Debug search failed',
      details: errorMessage
    }, { status: 500 });
  }
}
