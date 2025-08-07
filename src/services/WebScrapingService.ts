// V2 Service - Built from scratch

export interface ScrapedContent {
  url: string;
  title: string;
  content: string;
  metadata: {
    description?: string;
    keywords?: string[];
    author?: string;
    publishDate?: Date;
    language?: string;
  };
  performance: {
    loadTime: number;
    contentSize: number;
    scrapedAt: Date;
  };
}

export interface ScrapingOptions {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxContentLength?: number;
}

export class WebScrapingService {
  private readonly defaultOptions: ScrapingOptions = {
    timeout: 10000,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    followRedirects: true,
    maxContentLength: 1000000, // 1MB
  };

  async scrapeWebsite(url: string, options?: ScrapingOptions): Promise<ScrapedContent> {
    const startTime = Date.now();
    const config = { ...this.defaultOptions, ...options };
    
    try {
      // Validate and normalize URL
      const normalizedUrl = this.normalizeUrl(url);
      
      // Fetch content with timeout
      const response = await this.fetchWithTimeout(normalizedUrl, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const html = await response.text();
      
      if (html.length > config.maxContentLength!) {
        throw new Error(`Content too large: ${html.length} bytes`);
      }
      
      // Parse and clean content
      const parsed = this.parseHtmlContent(html);
      const cleanContent = this.cleanTextContent(parsed.content);
      
      const loadTime = Date.now() - startTime;
      
      return {
        url: normalizedUrl,
        title: parsed.title,
        content: cleanContent,
        metadata: {
          description: parsed.description,
          keywords: parsed.keywords,
          author: parsed.author,
          publishDate: parsed.publishDate,
          language: parsed.language,
        },
        performance: {
          loadTime,
          contentSize: html.length,
          scrapedAt: new Date(),
        }
      };
      
    } catch (error) {
      throw new Error(`Failed to scrape ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async scrapeMultipleUrls(urls: string[], options?: ScrapingOptions): Promise<ScrapedContent[]> {
    const results = await Promise.allSettled(
      urls.map(url => this.scrapeWebsite(url, options))
    );
    
    const successful = results
      .filter((result): result is PromiseFulfilledResult<ScrapedContent> => 
        result.status === 'fulfilled'
      )
      .map(result => result.value);
      
    if (successful.length === 0) {
      throw new Error('Failed to scrape any URLs successfully');
    }
    
    return successful;
  }

  private normalizeUrl(url: string): string {
    // Add protocol if missing
    if (!url.startsWith('http')) {
      url = `https://${url}`;
    }
    
    // Validate URL
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      throw new Error(`Invalid URL format: ${url}`);
    }
  }

  private async fetchWithTimeout(url: string, config: ScrapingOptions): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), config.timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': config.userAgent!,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        redirect: config.followRedirects ? 'follow' : 'manual',
      });
      
      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseHtmlContent(html: string) {
    // Remove scripts and styles
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Extract title
    const titleMatch = cleanHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // Extract meta description
    const descMatch = cleanHtml.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
    const description = descMatch ? descMatch[1] : undefined;
    
    // Extract meta keywords
    const keywordsMatch = cleanHtml.match(/<meta[^>]*name=["\']keywords["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
    const keywords = keywordsMatch ? keywordsMatch[1].split(',').map(k => k.trim()) : undefined;
    
    // Extract author
    const authorMatch = cleanHtml.match(/<meta[^>]*name=["\']author["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
    const author = authorMatch ? authorMatch[1] : undefined;
    
    // Extract language
    const langMatch = cleanHtml.match(/(?:lang|xml:lang)=["\']([^"\']+)["\']/) || 
                      cleanHtml.match(/<meta[^>]*http-equiv=["\']content-language["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
    const language = langMatch ? langMatch[1] : undefined;
    
    // Extract main content (remove all HTML tags)
    const content = cleanHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return {
      title,
      content,
      description,
      keywords,
      author,
      language,
      publishDate: undefined, // Would need more sophisticated parsing
    };
  }

  private cleanTextContent(content: string): string {
    return content
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove common noise words at the beginning
      .replace(/^(cookies?|privacy|terms|accept|continue|skip|menu|navigation)\s*/gi, '')
      // Remove email patterns for privacy
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      // Remove phone patterns for privacy
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
      // Limit content length to reasonable size
      .substring(0, 50000)
      .trim();
  }
}