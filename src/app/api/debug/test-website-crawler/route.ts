import { NextRequest, NextResponse } from 'next/server';
import { isFirecrawlAvailable, scrapeWebsiteWithFirecrawl } from '@/lib/firecrawl';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log(`🧪 Testing website crawler with URL: ${url}`);
    console.log(`🔥 Firecrawl available: ${isFirecrawlAvailable()}`);

    // Test Firecrawl if available
    if (isFirecrawlAvailable()) {
      console.log('Testing Firecrawl scraping...');
      
      const startTime = Date.now();
      const firecrawlResult = await scrapeWebsiteWithFirecrawl(url);
      const firecrawlDuration = Date.now() - startTime;
      
      if (firecrawlResult.success && firecrawlResult.data) {
        const { markdown, content, metadata } = firecrawlResult.data;
        
        return NextResponse.json({
          success: true,
          method: 'firecrawl',
          duration: `${firecrawlDuration}ms`,
          results: {
            contentLength: (markdown || content || '').length,
            hasMarkdown: !!markdown,
            hasContent: !!content,
            hasMetadata: !!metadata,
            title: metadata?.title,
            description: metadata?.description,
            preview: (markdown || content || '').substring(0, 500) + '...'
          }
        });
      } else {
        return NextResponse.json({
          success: false,
          method: 'firecrawl',
          duration: `${firecrawlDuration}ms`,
          error: firecrawlResult.error
        });
      }
    } else {
      // Test basic fetch
      console.log('Testing basic fetch (Firecrawl not available)...');
      
      const startTime = Date.now();
      
      try {
        // Create a timeout promise
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        const fetchDuration = Date.now() - startTime;
        
        if (!response.ok) {
          return NextResponse.json({
            success: false,
            method: 'basic_fetch',
            duration: `${fetchDuration}ms`,
            error: `HTTP ${response.status}: ${response.statusText}`
          });
        }
        
        const html = await response.text();
        
        return NextResponse.json({
          success: true,
          method: 'basic_fetch',
          duration: `${fetchDuration}ms`,
          results: {
            contentLength: html.length,
            statusCode: response.status,
            contentType: response.headers.get('content-type'),
            preview: html.substring(0, 500) + '...'
          }
        });
        
      } catch (fetchError) {
        const fetchDuration = Date.now() - startTime;
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          return NextResponse.json({
            success: false,
            method: 'basic_fetch',
            duration: `${fetchDuration}ms`,
            error: 'Request timeout (10 seconds)'
          });
        }
        
        return NextResponse.json({
          success: false,
          method: 'basic_fetch',
          duration: `${fetchDuration}ms`,
          error: fetchError instanceof Error ? fetchError.message : 'Fetch failed'
        });
      }
    }

  } catch (error) {
    console.error('Website crawler test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Website Crawler Test Endpoint',
    usage: 'POST with { "url": "https://example.com" }',
    firecrawlAvailable: isFirecrawlAvailable()
  });
}