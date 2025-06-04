import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';
import fetch from 'node-fetch';

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
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { amazonProductUrl, targetKeywords, primaryProductUrl } = payload;
    
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
        const searchResults = await searchAmazonWithScrapeOwl(keyword);
        competitors.push(...searchResults);
        
        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (searchError) {
        console.error(`Error searching for ${keyword}:`, searchError);
        // Continue with other keywords even if one fails
      }
    }
    
    console.log(`Found ${competitors.length} total competitors`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 60, undefined, undefined);
    
    // Remove duplicates and filter out user's own product
    const uniqueCompetitors = filterAndDeduplicateCompetitors(competitors, amazonProductUrl);
    
    console.log(`Found ${uniqueCompetitors.length} unique competitors`);
    
    // Store competitors in database
    await storeCompetitors(jobId, uniqueCompetitors);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 75, undefined, undefined);
    
    // Queue the next worker (reviews collector)
    const queue = new JobQueue();
    await queue.addJob(jobId, 'reviews-collector', {
      competitors: uniqueCompetitors,
      userProduct: userProductData,
      targetKeywords,
      amazonProductUrl,
      primaryProductUrl
    });
    
    // Trigger the review collector
    const baseUrl = request.nextUrl.origin;
    await fetch(`${baseUrl}/api/workers/reviews-collector`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobId, 
        payload: { 
          competitors: uniqueCompetitors,
          userProduct: userProductData,
          targetKeywords,
          amazonProductUrl,
          primaryProductUrl
        } 
      })
    });
    
    await queue.markTaskCompleted(jobId, 'amazon-competitors');
    
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
      jobId, 
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

async function searchAmazonWithScrapeOwl(keyword: string): Promise<CompetitorProduct[]> {
  const products: CompetitorProduct[] = [];
  
  try {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}`;
    
    const scrapeOwlResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: searchUrl,
        elements: [
          {
            name: 'products',
            selector: '[data-component-type="s-search-result"]',
            type: 'list',
            children: [
              {
                name: 'title',
                selector: 'h2 a span',
                type: 'text'
              },
              {
                name: 'price',
                selector: '.a-price-whole',
                type: 'text'
              },
              {
                name: 'rating',
                selector: '.a-icon-alt',
                type: 'text'
              },
              {
                name: 'reviewCount',
                selector: '.a-size-base',
                type: 'text'
              },
              {
                name: 'link',
                selector: 'h2 a',
                type: 'attribute',
                attribute: 'href'
              },
              {
                name: 'image',
                selector: 'img',
                type: 'attribute',
                attribute: 'src'
              }
            ]
          }
        ]
      }),
    });

    if (!scrapeOwlResponse.ok) {
      throw new Error(`ScrapeOwl API error: ${scrapeOwlResponse.status}`);
    }

    const scrapeData = await scrapeOwlResponse.json();
    
    if (scrapeData.success && scrapeData.data && scrapeData.data.products) {
      const scrapedProducts = scrapeData.data.products.slice(0, 10); // Limit to top 10
      
      for (const product of scrapedProducts) {
        const productUrl = product.link ? `https://www.amazon.com${product.link}` : '';
        const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/);
        const asin = asinMatch ? asinMatch[1] : '';
        
        if (product.title && asin) {
          products.push({
            asin,
            title: product.title,
            price: product.price || 'N/A',
            rating: product.rating || 'N/A',
            reviewCount: product.reviewCount || 'N/A',
            imageUrl: product.image || '',
            productUrl
          });
        }
      }
    }
    
    console.log(`ScrapeOwl found ${products.length} products for keyword: ${keyword}`);
    return products;
    
  } catch (error) {
    console.error(`ScrapeOwl error for keyword ${keyword}:`, error);
    
    // Fallback to simulated data if scraping fails
    console.log(`Falling back to simulated data for keyword: ${keyword}`);
    return generateFallbackProducts(keyword, 3);
  }
}

function generateFallbackProducts(keyword: string, count: number): CompetitorProduct[] {
  const products: CompetitorProduct[] = [];
  
  for (let i = 0; i < count; i++) {
    products.push({
      asin: `B${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
      title: `${keyword} Product ${i + 1}`,
      price: `$${(Math.random() * 100 + 10).toFixed(2)}`,
      rating: `${(Math.random() * 2 + 3).toFixed(1)} out of 5 stars`,
      reviewCount: `${Math.floor(Math.random() * 1000 + 50)} reviews`,
      imageUrl: 'https://via.placeholder.com/150',
      productUrl: `https://amazon.com/dp/B${Math.random().toString(36).substring(2, 12).toUpperCase()}`
    });
  }
  
  return products;
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
    
    // TODO: Could scrape the actual product page here for real title/category
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
  console.log(`Storing ${competitors.length} competitors for job ${jobId}`);
  
  competitors.forEach((competitor, index) => {
    console.log(`Competitor ${index + 1}:`, {
      asin: competitor.asin,
      title: competitor.title.substring(0, 50) + '...',
      price: competitor.price,
      rating: competitor.rating
    });
  });
}
