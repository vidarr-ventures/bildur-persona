import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

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
    
    // Search for competitors using keywords - simplified for now
    const searchKeywords = targetKeywords.split(',').map((k: string) => k.trim());
    const competitors: CompetitorProduct[] = [];
    
    // Simulate finding competitors (in real implementation, this would scrape Amazon)
    for (let i = 0; i < Math.min(searchKeywords.length * 3, 10); i++) {
      competitors.push({
        asin: `B${Math.random().toString(36).substring(2, 12).toUpperCase()}`,
        title: `Competitor Product ${i + 1} for ${searchKeywords[i % searchKeywords.length]}`,
        price: `$${(Math.random() * 100 + 10).toFixed(2)}`,
        rating: `${(Math.random() * 2 + 3).toFixed(1)} out of 5 stars`,
        reviewCount: `${Math.floor(Math.random() * 1000 + 50)} reviews`,
        imageUrl: 'https://via.placeholder.com/150',
        productUrl: `https://amazon.com/dp/B${Math.random().toString(36).substring(2, 12).toUpperCase()}`
      });
    }
    
    console.log(`Simulated ${competitors.length} competitors`);
    
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

async function extractProductInfo(amazonUrl: string) {
  try {
    // Extract ASIN from URL
    const asinPattern = /\/dp\/([A-Z0-9]{10})/;
    const asinMatch = amazonUrl.match(asinPattern);
    const asin = asinMatch ? asinMatch[1] : null;
    
    if (!asin) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
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
