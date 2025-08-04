/**
 * Shopify Integration for Website Crawler
 * Detects Shopify stores and uses specialized scraper for better review extraction
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface ShopifyScrapingResult {
  success: boolean;
  data?: {
    reviews: any[];
    products: any[];
    shop_name: string;
    total_reviews: number;
    scrape_method: string;
    tier: string;
    max_reviews_per_site: number;
    data_quality: {
      reviews_found: boolean;
      ratings_available: boolean;
      dates_available: boolean;
      tier_limit_applied: boolean;
      available_reviews_estimated: number;
      confidence_level: string;
    };
  };
  error?: string;
  method: 'shopify_scraper' | 'firecrawl' | 'basic_fetch';
}

/**
 * Detect if a URL is a Shopify store
 */
export function isShopifyStore(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.toLowerCase();
    
    // Direct Shopify domain check
    if (domain.includes('.myshopify.com')) {
      return true;
    }
    
    // Common patterns that suggest Shopify (we'll verify with a request)
    const shopifyIndicators = [
      // These are just hints, we'll verify with actual request
      'shopify', 'shop', 'store', 'buy'
    ];
    
    // For now, we'll do a more thorough check by examining the URL structure
    // Shopify stores often have /products/, /collections/, /cart paths
    return false; // We'll do runtime detection instead
  } catch {
    return false;
  }
}

/**
 * Detect Shopify store by examining page content/headers
 */
export async function detectShopifyFromResponse(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'HEAD', // Just check headers first
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    // Check headers for Shopify indicators
    const headers = response.headers;
    const serverHeader = headers.get('server') || '';
    const poweredBy = headers.get('x-powered-by') || '';
    const shopifyShop = headers.get('x-shopify-shop') || '';
    
    if (serverHeader.toLowerCase().includes('shopify') || 
        poweredBy.toLowerCase().includes('shopify') ||
        shopifyShop) {
      return true;
    }
    
    // If headers don't show Shopify, do a quick content check
    try {
      const contentResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        signal: controller.signal
      });
      
      const html = await contentResponse.text();
      
      // Check for Shopify indicators in HTML
      const shopifyIndicators = [
        'shopify',
        'cdn.shopify.com',
        'shop_money_format',
        'Shopify.shop',
        'window.Shopify',
        '/products/',
        '/collections/',
        'shopify-features'
      ];
      
      const lowerHTML = html.toLowerCase();
      return shopifyIndicators.some(indicator => lowerHTML.includes(indicator.toLowerCase()));
      
    } catch {
      return false;
    }
  } catch (error) {
    console.debug('Error detecting Shopify store:', error);
    return false;
  }
}

/**
 * Run Shopify scraper with specified tier
 */
export async function runShopifyScraper(
  url: string, 
  tier: 'basic' | 'premium' | 'enterprise' | 'pro' = 'premium',
  jobId: string = `job_${Date.now()}`
): Promise<ShopifyScrapingResult> {
  try {
    console.log(`🛍️ Running Shopify scraper for ${url} with tier: ${tier}`);
    
    // Construct the command to run our Python Shopify scraper
    const pythonScript = path.join(process.cwd(), 'integrate_shopify_scraper.py');
    const command = `python3 "${pythonScript}" "${url}" "${jobId}" "" --tier ${tier}`;
    
    console.log(`Executing: ${command}`);
    
    // Run the scraper with timeout
    const { stdout, stderr } = await execAsync(command, {
      timeout: 120000, // 2 minutes timeout
      cwd: process.cwd()
    });
    
    if (stderr && stderr.includes('Error')) {
      console.error('Shopify scraper stderr:', stderr);
      return {
        success: false,
        error: `Shopify scraper error: ${stderr}`,
        method: 'shopify_scraper'
      };
    }
    
    console.log('Shopify scraper output:', stdout);
    
    // Look for the generated pipeline data file
    const pipelineDataPath = path.join(process.cwd(), 'pipeline_data', `shopify_store_${jobId}.json`);
    
    if (fs.existsSync(pipelineDataPath)) {
      const rawData = fs.readFileSync(pipelineDataPath, 'utf8');
      const scrapedData = JSON.parse(rawData);
      
      console.log(`✅ Successfully scraped ${scrapedData.total_review_count || scrapedData.review_count || 0} reviews from Shopify store`);
      
      return {
        success: true,
        data: {
          reviews: scrapedData.reviews || [],
          products: scrapedData.products || [],
          shop_name: scrapedData.company_info?.name || 'Unknown',
          total_reviews: scrapedData.total_review_count || scrapedData.review_count || 0,
          scrape_method: scrapedData.metadata?.extraction_method || 'shopify_scraper',
          tier: tier,
          max_reviews_per_site: tier === 'basic' ? 20 : 200,
          data_quality: {
            reviews_found: (scrapedData.total_review_count || scrapedData.review_count || 0) > 0,
            ratings_available: scrapedData.analysis?.has_ratings || false,
            dates_available: scrapedData.analysis?.has_dates || false,
            tier_limit_applied: scrapedData.data_quality?.tier_limit_applied || false,
            available_reviews_estimated: scrapedData.data_quality?.available_reviews_estimated || 0,
            confidence_level: scrapedData.data_quality?.confidence_level || 'medium'
          }
        },
        method: 'shopify_scraper'
      };
    } else {
      console.error('Pipeline data file not found:', pipelineDataPath);
      return {
        success: false,
        error: 'Shopify scraper completed but no data file generated',
        method: 'shopify_scraper'
      };
    }
    
  } catch (error) {
    console.error('Error running Shopify scraper:', error);
    
    if (error instanceof Error && error.message.includes('timeout')) {
      return {
        success: false,
        error: 'Shopify scraper timed out (may still be processing)',
        method: 'shopify_scraper'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown Shopify scraper error',
      method: 'shopify_scraper'
    };
  }
}

/**
 * Convert Shopify scraper data to website crawler format
 */
export function convertShopifyDataToWebsiteFormat(shopifyData: any): {
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
  firecrawlUsed: boolean;
  dataQuality: any;
} {
  const reviews = shopifyData.reviews || [];
  const products = shopifyData.products || [];
  
  // Convert reviews to simple text array
  const customerReviews: string[] = reviews
    .map((review: any) => review.text)
    .filter((text: any): text is string => typeof text === 'string' && text.length > 0)
    .slice(0, 20);
  
  // Extract value propositions from review content
  const valuePropositions: string[] = [];
  reviews.slice(0, 10).forEach((review: any) => {
    const text = review.text || '';
    const sentences = text.split('.').map((s: string) => s.trim());
    sentences.forEach((sentence: string) => {
      if (sentence.length > 20 && sentence.length < 150 && 
          (sentence.toLowerCase().includes('quality') || 
           sentence.toLowerCase().includes('excellent') ||
           sentence.toLowerCase().includes('amazing') ||
           sentence.toLowerCase().includes('love') ||
           sentence.toLowerCase().includes('recommend'))) {
        valuePropositions.push(sentence);
      }
    });
  });
  
  // Extract features from products and reviews
  const features: string[] = [];
  products.forEach((product: any) => {
    if (product.title && typeof product.title === 'string') {
      features.push(product.title);
    }
  });
  
  // Add features mentioned in reviews
  reviews.slice(0, 5).forEach((review: any) => {
    const text = (review.text || '').toLowerCase();
    const featureKeywords = ['material', 'quality', 'design', 'size', 'comfort', 'easy', 'soft', 'durable'];
    featureKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        features.push(`Quality ${keyword}`);
      }
    });
  });
  
  // Use testimonials as highly rated reviews
  const testimonials: string[] = reviews
    .filter((review: any) => review.rating >= 5)
    .map((review: any) => review.text)
    .filter((text: any): text is string => typeof text === 'string' && text.length > 0)
    .slice(0, 8);
  
  // Create home page content from available data
  const homePageContent = [
    shopifyData.company_info?.description || '',
    products.map((p: any) => p.title).join(', '),
    reviews.slice(0, 3).map((r: any) => r.text).join(' ')
  ].filter(Boolean).join(' ').substring(0, 2000);
  
  // Brand messaging from company info
  const brandMessaging = shopifyData.company_info?.name || 
                        shopifyData.analysis?.brand_messaging || 
                        'Premium e-commerce store';
  
  // Remove duplicates manually to avoid TypeScript issues
  const uniqueCustomerReviews = Array.from(new Set(customerReviews)).slice(0, 20);
  const uniqueTestimonials = Array.from(new Set(testimonials)).slice(0, 8);
  const uniqueValuePropositions = Array.from(new Set(valuePropositions)).slice(0, 8);
  const uniqueFeatures = Array.from(new Set(features)).slice(0, 12);

  return {
    homePageContent,
    customerReviews: uniqueCustomerReviews,
    testimonials: uniqueTestimonials,
    valuePropositions: uniqueValuePropositions,
    features: uniqueFeatures,
    brandMessaging,
    firecrawlUsed: false,
    dataQuality: {
      method: 'shopify_scraper',
      contentLength: homePageContent.length,
      hasMetadata: true,
      reviewsExtracted: customerReviews.length,
      productsFound: products.length,
      scrapingTier: shopifyData.tier,
      totalReviewsAvailable: shopifyData.total_reviews,
      confidenceLevel: shopifyData.data_quality?.confidence_level
    }
  };
}

/**
 * Enhanced website crawling that detects and handles Shopify stores
 */
export async function enhancedWebsiteCrawling(
  websiteUrl: string, 
  targetKeywords: string,
  tier: 'basic' | 'premium' | 'enterprise' | 'pro' = 'premium',
  jobId?: string
): Promise<{
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
  firecrawlUsed: boolean;
  dataQuality: any;
}> {
  console.log(`🔍 Enhanced website crawling for: ${websiteUrl}`);
  
  // Step 1: Detect if this is a Shopify store
  const isShopify = await detectShopifyFromResponse(websiteUrl);
  
  if (isShopify) {
    console.log(`✅ Detected Shopify store, using specialized scraper`);
    
    const shopifyResult = await runShopifyScraper(websiteUrl, tier, jobId);
    
    if (shopifyResult.success && shopifyResult.data) {
      console.log(`🎉 Shopify scraper successful: ${shopifyResult.data.total_reviews} reviews extracted`);
      return convertShopifyDataToWebsiteFormat(shopifyResult.data);
    } else {
      console.warn(`⚠️ Shopify scraper failed: ${shopifyResult.error}, falling back to standard crawling`);
      // Fall back to standard method
    }
  } else {
    console.log(`ℹ️ Not a Shopify store, using standard crawling methods`);
  }
  
  // Fall back to existing crawling logic (Firecrawl + basic fetch)
  // This would be called from the main crawler
  return {
    homePageContent: '',
    customerReviews: [],
    testimonials: [],
    valuePropositions: [],
    features: [],
    brandMessaging: '',
    firecrawlUsed: false,
    dataQuality: {
      method: 'fallback_needed',
      shopifyDetected: isShopify,
      note: 'Shopify detection completed, needs fallback implementation'
    }
  };
}