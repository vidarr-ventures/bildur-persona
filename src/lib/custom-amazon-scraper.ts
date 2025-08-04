/**
 * Custom Amazon Review Scraper
 * Replaces Firecrawl for cost optimization
 * Uses direct HTTP requests with retry logic
 */

interface AmazonReview {
  id: string;
  reviewer: string;
  rating: number;
  title: string;
  text: string;
  date: string;
  verified: boolean;
  helpful_votes?: number;
}

interface AmazonScrapingResult {
  success: boolean;
  reviews: AmazonReview[];
  product: {
    title: string;
    rating: number;
    total_reviews: number;
    price?: string;
    image_url?: string;
  };
  metadata: {
    extraction_method: string;
    processing_time: number;
    pages_scraped: number;
    cost_savings: string;
  };
  error?: string;
}

export class CustomAmazonScraper {
  private readonly maxRetries = 3;
  private readonly delayBetweenRequests = 2000; // 2 seconds
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'User-Agent': this.getRandomUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            ...options.headers
          }
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 503 || response.status === 429) {
          console.log(`Amazon returned ${response.status}, waiting ${attempt * 5}s before retry ${attempt}/${this.maxRetries}`);
          await this.delay(attempt * 5000);
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        console.error(`Attempt ${attempt} failed:`, error);
        if (attempt === this.maxRetries) {
          throw error;
        }
        await this.delay(attempt * 2000);
      }
    }
    throw new Error('Max retries exceeded');
  }

  private extractProductInfo(html: string): any {
    const product: any = {};
    
    // Extract product title
    const titleMatch = html.match(/<span[^>]*id="productTitle"[^>]*>([^<]+)</i);
    product.title = titleMatch ? titleMatch[1].trim() : '';

    // Extract average rating
    const ratingMatch = html.match(/data-hook="average-star-rating"[^>]*>.*?(\d+\.?\d*)\s*out of/i);
    product.rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

    // Extract total review count
    const reviewCountMatch = html.match(/(\d+(?:,\d+)*)\s*(?:global\s*)?ratings?/i);
    product.total_reviews = reviewCountMatch ? parseInt(reviewCountMatch[1].replace(/,/g, '')) : 0;

    // Extract price
    const priceMatch = html.match(/class="a-price-whole">([^<]+)<\/span>.*?class="a-price-fraction">([^<]+)/i) ||
                      html.match(/\$(\d+(?:\.\d+)?)/);
    if (priceMatch) {
      product.price = priceMatch[1] + (priceMatch[2] ? '.' + priceMatch[2] : '');
    }

    return product;
  }

  private extractReviews(html: string): AmazonReview[] {
    const reviews: AmazonReview[] = [];
    
    // Find review blocks using multiple patterns
    const reviewPatterns = [
      /<div[^>]*data-hook="review"[^>]*>(.*?)<\/div>(?=<div[^>]*data-hook="review"|$)/gi,
      /<div[^>]*class="[^"]*review[^"]*"[^>]*>(.*?)<\/div>(?=<div[^>]*class="[^"]*review|$)/gi
    ];

    let reviewBlocks: string[] = [];
    
    for (const pattern of reviewPatterns) {
      const matches = Array.from(html.matchAll(pattern));
      if (matches.length > 0) {
        reviewBlocks = matches.map(match => match[1]);
        break;
      }
    }

    reviewBlocks.forEach((block, index) => {
      try {
        const review: AmazonReview = {
          id: `amazon_${index + 1}`,
          reviewer: '',
          rating: 0,
          title: '',
          text: '',
          date: '',
          verified: false
        };

        // Extract reviewer name
        const reviewerMatch = block.match(/class="a-profile-name">([^<]+)</i);
        review.reviewer = reviewerMatch ? reviewerMatch[1].trim() : 'Anonymous';

        // Extract rating
        const ratingMatch = block.match(/(\d+\.?\d*)\s*out of \d+ stars/i) ||
                           block.match(/a-star-(\d+)/i);
        review.rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

        // Extract review title
        const titleMatch = block.match(/data-hook="review-title"[^>]*>.*?>([^<]+)</i);
        review.title = titleMatch ? titleMatch[1].trim() : '';

        // Extract review text
        const textMatch = block.match(/data-hook="review-body"[^>]*>.*?<span[^>]*>([^<]+(?:<[^>]*>[^<]*)*?)<\/span>/i);
        review.text = textMatch ? textMatch[1].replace(/<[^>]*>/g, '').trim() : '';

        // Extract date
        const dateMatch = block.match(/on\s+([A-Z][a-z]+\s+\d+,\s+\d+)/i);
        review.date = dateMatch ? dateMatch[1] : '';

        // Check if verified purchase
        review.verified = block.includes('Verified Purchase') || block.includes('verified purchase');

        // Extract helpful votes
        const helpfulMatch = block.match(/(\d+)\s+people found this helpful/i);
        review.helpful_votes = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;

        // Only add review if we have meaningful content
        if (review.text.length > 10 || review.title.length > 5) {
          reviews.push(review);
        }
      } catch (error) {
        console.error(`Error parsing review ${index}:`, error);
      }
    });

    return reviews;
  }

  private extractProductId(url: string): string | null {
    // Extract ASIN from various Amazon URL formats
    const patterns = [
      /\/dp\/([A-Z0-9]{10})/i,
      /\/product\/([A-Z0-9]{10})/i,
      /asin=([A-Z0-9]{10})/i,
      /\/([A-Z0-9]{10})(?:\/|$|\?)/i
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    return null;
  }

  private buildReviewsUrl(productId: string, pageNumber: number = 1): string {
    return `https://www.amazon.com/product-reviews/${productId}/ref=cm_cr_arp_d_paging_btm_next_${pageNumber}?pageNumber=${pageNumber}&sortBy=recent`;
  }

  async scrapeAmazonReviews(url: string, maxReviews: number = 50): Promise<AmazonScrapingResult> {
    const startTime = Date.now();
    let pagesScrapped = 0;
    
    try {
      console.log(`🛒 Starting custom Amazon scraping for: ${url}`);
      
      // Extract product ID
      const productId = this.extractProductId(url);
      if (!productId) {
        throw new Error('Could not extract product ID from Amazon URL');
      }

      console.log(`📦 Product ID: ${productId}`);

      // Scrape product page first
      const productResponse = await this.fetchWithRetry(url);
      const productHtml = await productResponse.text();
      const product = this.extractProductInfo(productHtml);
      pagesScrapped++;

      console.log(`📊 Product: ${product.title} (${product.rating}/5, ${product.total_reviews} reviews)`);

      let allReviews: AmazonReview[] = [];
      let currentPage = 1;
      const maxPages = Math.ceil(maxReviews / 10); // ~10 reviews per page

      // Scrape review pages
      while (allReviews.length < maxReviews && currentPage <= maxPages && currentPage <= 5) {
        console.log(`📄 Scraping reviews page ${currentPage}...`);
        
        const reviewsUrl = this.buildReviewsUrl(productId, currentPage);
        
        try {
          const reviewResponse = await this.fetchWithRetry(reviewsUrl);
          const reviewHtml = await reviewResponse.text();
          const pageReviews = this.extractReviews(reviewHtml);
          
          if (pageReviews.length === 0) {
            console.log('No more reviews found, stopping');
            break;
          }

          allReviews.push(...pageReviews);
          pagesScrapped++;
          
          console.log(`✅ Page ${currentPage}: Found ${pageReviews.length} reviews (total: ${allReviews.length})`);
          
          // Delay between pages to be respectful
          if (currentPage < maxPages) {
            await this.delay(this.delayBetweenRequests);
          }
          
          currentPage++;
        } catch (pageError) {
          console.warn(`⚠️ Failed to scrape page ${currentPage}:`, pageError);
          break;
        }
      }

      // Limit to requested number of reviews
      allReviews = allReviews.slice(0, maxReviews);

      const processingTime = Date.now() - startTime;
      
      console.log(`🎉 Amazon scraping complete: ${allReviews.length} reviews in ${processingTime}ms`);

      return {
        success: true,
        reviews: allReviews,
        product,
        metadata: {
          extraction_method: 'custom_amazon_scraper',
          processing_time: processingTime,
          pages_scraped: pagesScrapped,
          cost_savings: 'Eliminated Firecrawl costs (~$0.50-2.00 per job)'
        }
      };

    } catch (error) {
      console.error('❌ Amazon scraping failed:', error);
      
      return {
        success: false,
        reviews: [],
        product: { title: '', rating: 0, total_reviews: 0 },
        metadata: {
          extraction_method: 'custom_amazon_scraper',
          processing_time: Date.now() - startTime,
          pages_scraped: pagesScrapped,
          cost_savings: 'Eliminated Firecrawl costs'
        },
        error: error instanceof Error ? error.message : 'Unknown scraping error'
      };
    }
  }
}

// Export singleton instance
export const customAmazonScraper = new CustomAmazonScraper();