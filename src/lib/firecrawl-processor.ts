/**
 * Enhanced Web Scraper using Firecrawl API
 * Integrates with existing persona generation pipeline
 */

interface FirecrawlScrapeOptions {
  formats?: string[];
  headers?: Record<string, string>;
  includeTags?: string[];
  excludeTags?: string[];
  onlyMainContent?: boolean;
  removeTags?: string[];
  replaceAllPathsWithAbsolutePaths?: boolean;
  screenshot?: boolean;
  fullPageScreenshot?: boolean;
  waitFor?: number;
}

interface FirecrawlCrawlOptions {
  crawlerOptions?: {
    includes?: string[];
    excludes?: string[];
    generateImgAltText?: boolean;
    returnOnlyUrls?: boolean;
    maxDepth?: number;
    mode?: 'default' | 'fast';
    ignoreSitemap?: boolean;
    limit?: number;
    allowBackwardCrawling?: boolean;
    allowExternalContentLinks?: boolean;
  };
  pageOptions?: FirecrawlScrapeOptions;
}

interface FirecrawlResponse {
  success: boolean;
  data?: {
    content: string;
    markdown: string;
    html: string;
    rawHtml?: string;
    screenshot?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      keywords?: string;
      robots?: string;
      ogTitle?: string;
      ogDescription?: string;
      ogUrl?: string;
      ogImage?: string;
      ogAudio?: string;
      ogDeterminer?: string;
      ogLocale?: string;
      ogLocaleAlternate?: string[];
      ogSiteName?: string;
      ogVideo?: string;
      dctermsCreated?: string;
      dctermsType?: string;
      dctermsFormat?: string;
      dctermsIdentifier?: string;
      dctermsLanguage?: string;
      dctermsModified?: string;
      dctermsPartOf?: string;
      dctermsPublisher?: string;
      dctermsRights?: string;
      dctermsRightsHolder?: string;
      dctermsSubject?: string;
      dctermsTitle?: string;
      linkIcon?: string;
      linkCanonical?: string;
      linkAlternate?: string;
      linkAppleTouchIcon?: string;
      linkShortcut?: string;
      metaColorScheme?: string;
      metaThemeColor?: string;
      metaViewport?: string;
      jsonLd?: string;
    };
  };
  error?: string;
}

interface CrawlResponse {
  success: boolean;
  completed?: number;
  total?: number;
  creditsUsed?: number;
  expiresAt?: string;
  data?: Array<{
    content: string;
    markdown: string;
    html: string;
    rawHtml?: string;
    metadata?: any;
    screenshot?: string;
  }>;
  error?: string;
}

export class FirecrawlProcessor {
  private apiKey: string;
  private baseUrl = 'https://api.firecrawl.dev/v0';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.FIRECRAWL_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('Firecrawl API key is required. Set FIRECRAWL_API_KEY environment variable.');
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...options.headers,
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Firecrawl API error: ${data.error || response.statusText}`);
    }

    return data;
  }

  /**
   * Scrape a single URL with Firecrawl
   */
  async scrapeUrl(
    url: string, 
    options: FirecrawlScrapeOptions = {}
  ): Promise<FirecrawlResponse> {
    console.log(`[FIRECRAWL] Scraping URL: ${url}`);
    
    const defaultOptions: FirecrawlScrapeOptions = {
      formats: ['markdown', 'html'],
      onlyMainContent: true,
      includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'span', 'div'],
      excludeTags: ['nav', 'footer', 'header', 'aside', 'script', 'style'],
      removeTags: ['script', 'style', 'noscript'],
      waitFor: 1000,
      ...options
    };

    try {
      const response = await this.makeRequest('/scrape', {
        method: 'POST',
        body: JSON.stringify({
          url,
          pageOptions: defaultOptions
        })
      });

      console.log(`[FIRECRAWL] Successfully scraped: ${url}`);
      return response;
    } catch (error) {
      console.error(`[FIRECRAWL] Error scraping ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Crawl multiple pages from a website
   */
  async crawlWebsite(
    url: string, 
    options: FirecrawlCrawlOptions = {}
  ): Promise<CrawlResponse> {
    console.log(`[FIRECRAWL] Starting crawl for: ${url}`);
    
    const defaultOptions: FirecrawlCrawlOptions = {
      crawlerOptions: {
        generateImgAltText: false,
        returnOnlyUrls: false,
        maxDepth: 3,
        mode: 'fast',
        limit: 10,
        allowBackwardCrawling: false,
        allowExternalContentLinks: false,
        includes: ['*/blog/*', '*/faq/*', '*/help/*', '*/support/*', '*/about/*', '*/pricing/*'],
        excludes: ['*/admin/*', '*/login/*', '*/cart/*', '*/checkout/*', '*/account/*'],
        ...options.crawlerOptions
      },
      pageOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a'],
        excludeTags: ['nav', 'footer', 'header', 'aside', 'script', 'style'],
        removeTags: ['script', 'style', 'noscript'],
        ...options.pageOptions
      }
    };

    try {
      const response = await this.makeRequest('/crawl', {
        method: 'POST',
        body: JSON.stringify({
          url,
          ...defaultOptions
        })
      });

      console.log(`[FIRECRAWL] Crawl initiated for: ${url}`);
      return response;
    } catch (error) {
      console.error(`[FIRECRAWL] Error crawling ${url}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Enhanced scraping for persona generation
   */
  async scrapeForPersonaGeneration(
    url: string, 
    keywordPhrases: string[] = []
  ): Promise<{
    content: string;
    metadata: any;
    pageCount: number;
    totalChars: number;
    relevantPages: string[];
  }> {
    console.log(`[FIRECRAWL] Scraping for persona generation: ${url}`);
    console.log(`[FIRECRAWL] Keywords: ${keywordPhrases.join(', ')}`);

    // Enhanced crawl options for persona-relevant content
    const crawlOptions: FirecrawlCrawlOptions = {
      crawlerOptions: {
        maxDepth: 2,
        limit: 15,
        mode: 'fast',
        includes: [
          '/*', // Include all pages initially
          '*/blog/*', '*/article/*', '*/post/*',
          '*/faq/*', '*/help/*', '*/support/*',
          '*/about/*', '*/story/*', '*/mission/*',
          '*/pricing/*', '*/plans/*',
          '*/testimonial/*', '*/review/*', '*/case-study/*',
          '*/product/*', '*/service/*', '*/solution/*'
        ],
        excludes: [
          '*/admin/*', '*/login/*', '*/cart/*', '*/checkout/*', 
          '*/account/*', '*/dashboard/*', '*/api/*', '*/wp-admin/*',
          '*/privacy/*', '*/terms/*', '*/legal/*',
          '*/tag/*', '*/category/*', '*/author/*'
        ],
        generateImgAltText: false,
        returnOnlyUrls: false,
        allowExternalContentLinks: false
      },
      pageOptions: {
        formats: ['markdown'],
        onlyMainContent: true,
        includeTags: ['title', 'meta', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'li'],
        excludeTags: ['nav', 'footer', 'header', 'aside', 'script', 'style', 'iframe', 'embed'],
        removeTags: ['script', 'style', 'noscript', 'iframe'],
        waitFor: 2000
      }
    };

    try {
      const crawlResponse = await this.crawlWebsite(url, crawlOptions);
      
      if (!crawlResponse.success || !crawlResponse.data) {
        // Fallback to single page scrape
        console.log(`[FIRECRAWL] Crawl failed, falling back to single page scrape`);
        const scrapeResponse = await this.scrapeUrl(url);
        
        if (scrapeResponse.success && scrapeResponse.data) {
          return {
            content: scrapeResponse.data.markdown || scrapeResponse.data.content || '',
            metadata: scrapeResponse.data.metadata || {},
            pageCount: 1,
            totalChars: (scrapeResponse.data.markdown || scrapeResponse.data.content || '').length,
            relevantPages: [url]
          };
        } else {
          throw new Error('Both crawl and scrape failed');
        }
      }

      // Process crawled data
      let allContent = '';
      const allMetadata: any[] = [];
      const relevantPages: string[] = [];
      let totalChars = 0;

      // Score and filter pages based on relevance
      const scoredPages = crawlResponse.data.map((page, index) => {
        const content = page.markdown || page.content || '';
        const title = page.metadata?.title || '';
        const description = page.metadata?.description || '';
        const fullText = `${title} ${description} ${content}`.toLowerCase();
        
        let relevanceScore = 0;
        
        // Keyword matching
        if (keywordPhrases.length > 0) {
          keywordPhrases.forEach(phrase => {
            const phraseWords = phrase.toLowerCase().split(' ');
            const phraseMatches = phraseWords.filter(word => fullText.includes(word)).length;
            relevanceScore += (phraseMatches / phraseWords.length) * 10;
            
            // Direct phrase match bonus
            if (fullText.includes(phrase.toLowerCase())) {
              relevanceScore += 15;
            }
          });
        }
        
        // Content quality score
        if (content.length > 500) relevanceScore += 5;
        if (content.length > 1000) relevanceScore += 5;
        if (title.length > 10) relevanceScore += 3;
        if (description && description.length > 50) relevanceScore += 3;
        
        // High-value page type detection
        const url = page.metadata?.ogUrl || '';
        const highValuePatterns = [
          /blog|article|post/i, /faq|help|support/i, /about|story|mission/i,
          /testimonial|review|case[_-]?study/i, /product|service|solution/i,
          /pricing|plans|cost/i
        ];
        
        if (highValuePatterns.some(pattern => pattern.test(url) || pattern.test(title))) {
          relevanceScore += 8;
        }

        return {
          ...page,
          relevanceScore,
          url: page.metadata?.ogUrl || url,
          index
        };
      });

      // Sort by relevance and take top pages
      const topPages = scoredPages
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 12); // Limit to top 12 most relevant pages

      // Combine content from top pages
      topPages.forEach((page, idx) => {
        const content = page.markdown || page.content || '';
        const title = page.metadata?.title || `Page ${idx + 1}`;
        
        if (content.trim().length > 100) { // Only include substantial content
          allContent += `\n\n=== ${title.toUpperCase()} ===\n${content.trim()}`;
          allMetadata.push(page.metadata || {});
          relevantPages.push(page.url);
          totalChars += content.length;
        }
      });

      // Limit total content size (keep best content)
      const maxContentLength = 100000; // 100k chars
      if (allContent.length > maxContentLength) {
        allContent = allContent.substring(0, maxContentLength);
        totalChars = maxContentLength;
      }

      console.log(`[FIRECRAWL] Successfully processed ${topPages.length} pages`);
      console.log(`[FIRECRAWL] Total content: ${totalChars} characters`);

      return {
        content: allContent,
        metadata: {
          pages: allMetadata,
          crawlStats: {
            totalPagesFound: crawlResponse.data.length,
            relevantPagesUsed: topPages.length,
            creditsUsed: crawlResponse.creditsUsed || 0
          }
        },
        pageCount: topPages.length,
        totalChars,
        relevantPages
      };

    } catch (error) {
      console.error(`[FIRECRAWL] Error in persona scraping:`, error);
      throw error;
    }
  }
}

/**
 * Enhanced scrapeWebsite function using Firecrawl
 */
export async function scrapeWebsiteWithFirecrawl(
  url: string, 
  keywordPhrases: string[] = []
): Promise<{
  content: string;
  metadata: {
    totalPages: number;
    relevantPages: string[];
    scrapingMethod: string;
    creditsUsed?: number;
  };
}> {
  console.log(`[ENHANCED] Starting Firecrawl-powered scraping for: ${url}`);
  
  try {
    const firecrawl = new FirecrawlProcessor();
    const result = await firecrawl.scrapeForPersonaGeneration(url, keywordPhrases);
    
    console.log(`[ENHANCED] Firecrawl scraping completed successfully`);
    console.log(`[ENHANCED] Pages processed: ${result.pageCount}`);
    console.log(`[ENHANCED] Content length: ${result.totalChars} characters`);
    
    return {
      content: result.content,
      metadata: {
        totalPages: result.pageCount,
        relevantPages: result.relevantPages,
        scrapingMethod: 'firecrawl',
        creditsUsed: result.metadata?.crawlStats?.creditsUsed
      }
    };
    
  } catch (error) {
    console.error(`[ENHANCED] Firecrawl scraping failed:`, error);
    console.log(`[ENHANCED] Falling back to basic scraping...`);
    
    // Import and use the existing scraping function as fallback
    const { scrapeWebsite } = await import('./simple-processor');
    const fallbackResult = await scrapeWebsite(url, keywordPhrases);
    
    return {
      content: fallbackResult.content,
      metadata: {
        totalPages: fallbackResult.metadata?.totalPages || 1,
        relevantPages: [url],
        scrapingMethod: 'fallback'
      }
    };
  }
}