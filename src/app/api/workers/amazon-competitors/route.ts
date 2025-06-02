import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface CompetitorProduct {
  asin: string;
  title: string;
  price: string;
  rating: string;
  reviewCount: string;
  imageUrl: string;
  productUrl: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId, payload } = body;
    const { amazonProductUrl, targetKeywords } = payload;
    
    console.log(`Starting Amazon competitor discovery for job ${jobId}`);
    
    // Update job status to processing
    await updateJobStatus(jobId, 'processing', 10, undefined, undefined);
    
    // Extract category and keywords from user's Amazon product
    const userProductData = await extractProductInfo(amazonProductUrl);
    console.log('User product data:', userProductData);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 25, undefined, undefined);
    
    // Search for competitors using keywords
    const searchKeywords = targetKeywords.split(',').map((k: string) => k.trim());
    const competitors: CompetitorProduct[] = [];
    
    for (const keyword of searchKeywords) {
      console.log(`Searching Amazon for keyword: ${keyword}`);
      
      try {
        const searchResults = await searchAmazonProducts(keyword);
        competitors.push(...searchResults);
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (searchError) {
        console.error(`Error searching for ${keyword}:`, searchError);
      }
    }
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 60, undefined, undefined);
    
    // Remove duplicates and filter out user's own product
    const uniqueCompetitors = filterAndDeduplicateCompetitors(competitors, amazonProductUrl);
    
    console.log(`Found ${uniqueCompetitors.length} unique competitors`);
    
    // Store competitors in database (we'll create this function)
    await storeCompetitors(jobId, uniqueCompetitors);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 75, undefined, undefined);
    
    // Queue the next worker (reviews collector)
    const queue = new JobQueue();
    await queue.addJob(jobId, 'reviews-collector', {
      competitors: uniqueCompetitors,
      userProduct: userProductData,
      targetKeywords
    });
    
    await queue.markTaskCompleted(jobId, 'amazon-competitors');
    
    // Mark job as completed for now (until we build reviews collector)
    await updateJobStatus(jobId, 'completed', 100, undefined, undefined);
    
    console.log(`Amazon competitor discovery completed for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Amazon competitor discovery completed',
      competitorsFound: uniqueCompetitors.length
    });

  } catch (error) {
    console.error('Amazon competitor discovery error:', error);
    
    // Update job status to failed
    await updateJobStatus(
      body.jobId, 
      'failed', 
      0, 
      undefined, 
      `Amazon competitor discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Amazon competitor discovery failed' },
      { status: 500 }
    );
  }
}

async function extractProductInfo(amazonUrl: string) {
  try {
    // Extract ASIN from URL
    const asinPattern = /\/dp\/([A-Z0-9]{10})/;
    const asinMatch = amazonUrl.match(asinPattern);
    const asin = asinMatch ? asinMatch[1] : null;
    
    if (!asin) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
    // In a real implementation, you would scrape the product page
    // For now, return basic info
    return {
      asin,
      title: 'User Product',
      category: 'Unknown',
      keywords: []
    };
    
  } catch (error) {
    console.error('Error extracting product info:', error);
    throw error;
  }
}

async function searchAmazonProducts(keyword: string): Promise<CompetitorProduct[]> {
  try {
    // WARNING: This is a simplified example
    // In production, you would need:
    // 1. Proper User-Agent rotation
    // 2. Proxy servers
    // 3. Rate limiting
    // 4. CAPTCHA handling
    // 5. Consider using Amazon API if available
    
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
    
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);
    const products: CompetitorProduct[] = [];
    
    // Amazon search results selector (may need updating as Amazon changes their HTML)
    $('[data-component-type="s-search-result"]').each((index, element) => {
      if (index >= 10) return; // Limit to first 10 results
      
      const $element = $(element);
      
      // Extract product data
      const titleElement = $element.find('h2 a span');
      const title = titleElement.text().trim();
      
      const priceElement = $element.find('.a-price-whole');
      const price = priceElement.first().text().trim();
      
      const ratingElement = $element.find('.a-icon-alt');
      const rating = ratingElement.first().text().trim();
      
      const reviewElement = $element.find('.a-size-base');
      const reviewCount = reviewElement.text().trim();
      
      const linkElement = $element.find('h2 a');
      const productPath = linkElement.attr('href');
      const productUrl = productPath ? `https://www.amazon.com${productPath}` : '';
      
      const imageElement = $element.find('img');
      const imageUrl = imageElement.attr('src') || '';
      
      // Extract ASIN from URL
      const asinPattern = /\/dp\/([A-Z0-9]{10})/;
      const asinMatch = productUrl.match(asinPattern);
      const asin = asinMatch ? asinMatch[1] : '';
      
      if (title && asin) {
        products.push({
          asin,
          title,
          price: price || 'N/A',
          rating: rating || 'N/A',
          reviewCount: reviewCount || 'N/A',
          imageUrl,
          productUrl
        });
      }
    });
    
    console.log(`Found ${products.length} products for keyword: ${keyword}`);
    return products;
    
  } catch (error) {
    console.error(`Error searching Amazon for ${keyword}:`, error);
    return [];
  }
}

function filterAndDeduplicateCompetitors(competitors: CompetitorProduct[], userProductUrl: string): CompetitorProduct[] {
  // Extract user's ASIN to filter out
  const asinPattern = /\/dp\/([A-Z0-9]{10})/;
  const userAsinMatch = userProductUrl.match(asinPattern);
  const userAsin = userAsinMatch ? userAsinMatch[1] : '';
  
  // Remove duplicates by ASIN and filter out user's product
  const seen = new Set<string>();
  const filtered = competitors.filter(product => {
    if (seen.has(product.asin) || product.asin === userAsin) {
      return false;
    }
    seen.add(product.asin);
    return true;
  });
  
  return filtered;
}

async function storeCompetitors(jobId: string, competitors: CompetitorProduct[]) {
  // For now, we'll just log the competitors
  // In a full implementation, you would store these in the database
  console.log(`Storing ${competitors.length} competitors for job ${jobId}`);
  
  competitors.forEach((competitor, index) => {
    console.log(`Competitor ${index + 1}:`, {
      asin: competitor.asin,
      title: competitor.title.substring(0, 50) + '...',
      price: competitor.price,
      rating: competitor.rating
    });
  });
  
  // TODO: Add database storage for competitors
  // await sql`INSERT INTO competitors (job_id, asin, title, price, rating, review_count, image_url, product_url) VALUES ...`
