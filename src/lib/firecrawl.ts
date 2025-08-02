import FirecrawlApp from '@mendable/firecrawl-js';

// Initialize Firecrawl only if API key is available
const firecrawl = process.env.FIRECRAWL_API_KEY 
  ? new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })
  : null;

export interface FirecrawlResult {
  success: boolean;
  data?: {
    markdown?: string;
    content?: string;
    metadata?: {
      title?: string;
      description?: string;
      keywords?: string;
      ogTitle?: string;
      ogDescription?: string;
    };
    screenshot?: string;
  };
  error?: string;
}

export interface FirecrawlSearchResult {
  success: boolean;
  data?: Array<{
    url: string;
    title: string;
    description: string;
    content: string;
    markdown: string;
  }>;
  error?: string;
}

/**
 * Enhanced website scraping using Firecrawl
 */
export async function scrapeWebsiteWithFirecrawl(url: string): Promise<FirecrawlResult> {
  if (!firecrawl) {
    return {
      success: false,
      error: 'Firecrawl not configured - FIRECRAWL_API_KEY missing'
    };
  }

  try {
    console.log(`🔥 Scraping website with Firecrawl: ${url}`);
    
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown', 'html'],
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p', 'blockquote', 'ul', 'ol', 'li'],
      excludeTags: ['script', 'style', 'nav', 'footer', 'aside'],
      onlyMainContent: true
    });

    if (!scrapeResult.success) {
      return {
        success: false,
        error: scrapeResult.error || 'Firecrawl scraping failed'
      };
    }

    return {
      success: true,
      data: {
        markdown: scrapeResult.data?.markdown,
        content: scrapeResult.data?.content,
        metadata: scrapeResult.data?.metadata,
        screenshot: scrapeResult.data?.screenshot
      }
    };

  } catch (error) {
    console.error('Firecrawl scraping error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Firecrawl error'
    };
  }
}

/**
 * Enhanced Reddit scraping using Firecrawl for better comment extraction
 */
export async function scrapeRedditWithFirecrawl(searchUrl: string): Promise<FirecrawlResult> {
  if (!firecrawl) {
    return {
      success: false,
      error: 'Firecrawl not configured - FIRECRAWL_API_KEY missing'
    };
  }

  try {
    console.log(`🔥 Scraping Reddit with Firecrawl: ${searchUrl}`);
    
    const scrapeResult = await firecrawl.scrapeUrl(searchUrl, {
      formats: ['markdown'],
      includeTags: ['article', 'div[data-testid]', 'p', 'span'],
      excludeTags: ['script', 'style', 'nav', 'header', 'footer', 'aside'],
      waitFor: 2000, // Wait for dynamic content
      onlyMainContent: true
    });

    if (!scrapeResult.success) {
      return {
        success: false,
        error: scrapeResult.error || 'Reddit Firecrawl scraping failed'
      };
    }

    return {
      success: true,
      data: {
        markdown: scrapeResult.data?.markdown,
        content: scrapeResult.data?.content,
        metadata: scrapeResult.data?.metadata
      }
    };

  } catch (error) {
    console.error('Reddit Firecrawl scraping error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Reddit Firecrawl error'
    };
  }
}

/**
 * AI-powered market research using Firecrawl search
 */
export async function performMarketResearch(query: string, maxResults: number = 10): Promise<FirecrawlSearchResult> {
  if (!firecrawl) {
    return {
      success: false,
      error: 'Firecrawl not configured - FIRECRAWL_API_KEY missing'
    };
  }

  try {
    console.log(`🔥 Performing market research with Firecrawl: ${query}`);
    
    const searchResult = await firecrawl.search(query, {
      limit: maxResults,
      format: 'markdown',
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'p', 'article'],
      excludeTags: ['script', 'style', 'nav', 'footer', 'aside']
    });

    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error || 'Firecrawl search failed'
      };
    }

    return {
      success: true,
      data: searchResult.data
    };

  } catch (error) {
    console.error('Firecrawl market research error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown market research error'
    };
  }
}

/**
 * Batch scraping for competitor analysis
 */
export async function scrapeCompetitorsWithFirecrawl(urls: string[]): Promise<Array<FirecrawlResult & { url: string }>> {
  if (!firecrawl) {
    return urls.map(url => ({
      url,
      success: false,
      error: 'Firecrawl not configured - FIRECRAWL_API_KEY missing'
    }));
  }

  const results: Array<FirecrawlResult & { url: string }> = [];

  for (const url of urls) {
    try {
      console.log(`🔥 Scraping competitor with Firecrawl: ${url}`);
      
      const result = await scrapeWebsiteWithFirecrawl(url);
      results.push({ ...result, url });

      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      results.push({
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown competitor scraping error'
      });
    }
  }

  return results;
}

/**
 * Check if Firecrawl is configured and available
 */
export function isFirecrawlAvailable(): boolean {
  return !!firecrawl && !!process.env.FIRECRAWL_API_KEY;
}

/**
 * Get Firecrawl configuration status
 */
export function getFirecrawlStatus() {
  return {
    configured: !!process.env.FIRECRAWL_API_KEY,
    available: isFirecrawlAvailable(),
    apiKeyLength: process.env.FIRECRAWL_API_KEY?.length || 0
  };
}