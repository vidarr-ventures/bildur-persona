import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';

interface ProductInfo {
  title: string;
  price: string;
  rating: string;
  reviews: string;
  category: string;
}

async function extractProductInfo(url: string): Promise<ProductInfo | null> {
  try {
    const scrapeResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: url,
        elements: [
          { name: 'title', selector: '#productTitle, h1.a-size-large' },
          { name: 'price', selector: '.a-price-whole, .a-offscreen' },
          { name: 'rating', selector: '.a-icon-alt, [data-hook="average-star-rating"]' },
          { name: 'reviews', selector: '[data-hook="total-review-count"]' },
        ],
      }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Scraping failed: ${scrapeResponse.statusText}`);
    }

    const data = await scrapeResponse.json();
    return {
      title: data.title || 'Unknown Product',
      price: data.price || 'Price not found',
      rating: data.rating || 'No rating',
      reviews: data.reviews || 'No reviews',
      category: extractCategoryFromTitle(data.title || ''),
    };
  } catch (error) {
    console.error('Error extracting product info:', error);
    return null;
  }
}

function extractCategoryFromTitle(title: string): string {
  const keywords = title.toLowerCase().split(' ');
  const categories = ['electronics', 'clothing', 'books', 'home', 'kitchen', 'tools', 'sports'];
  
  for (const category of categories) {
    if (keywords.some(word => word.includes(category))) {
      return category;
    }
  }
  return 'general';
}

async function searchCompetitors(category: string, keywords: string): Promise<any[]> {
  try {
    const searchQuery = `${category} ${keywords}`.trim();
    const amazonSearchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(searchQuery)}`;

    const scrapeResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: amazonSearchUrl,
        elements: [
          { 
            name: 'products', 
            selector: '[data-component-type="s-search-result"]',
            multiple: true,
            children: [
              { name: 'title', selector: 'h2 a span' },
              { name: 'price', selector: '.a-price-whole' },
              { name: 'rating', selector: '.a-icon-alt' },
              { name: 'url', selector: 'h2 a', attribute: 'href' },
            ]
          }
        ],
      }),
    });

    if (!scrapeResponse.ok) {
      throw new Error(`Search scraping failed: ${scrapeResponse.statusText}`);
    }

    const data = await scrapeResponse.json();
    return data.products || [];
  } catch (error) {
    console.error('Error searching competitors:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords, amazonUrl } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting Amazon competitor analysis for job ${jobId}`);
    
    // Update job status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Extract category and keywords from user's Amazon product
    const userProductData = await extractProductInfo(amazonUrl);
    
    if (!userProductData) {
      await updateJobStatus(jobId, 'processing');
      console.log('Could not extract product info, using fallback search');
    }

    const searchCategory = userProductData?.category || 'general';
    const searchKeywords = targetKeywords || userProductData?.title || 'product';

    console.log(`Searching for competitors in category: ${searchCategory}, keywords: ${searchKeywords}`);

    // Search for competitor products
    await updateJobStatus(jobId, 'processing');
    const competitors = await searchCompetitors(searchCategory, searchKeywords);

    // Process and analyze competitor data
    await updateJobStatus(jobId, 'processing');
    const competitorAnalysis = {
      userProduct: userProductData,
      searchQuery: {
        category: searchCategory,
        keywords: searchKeywords,
      },
      competitors: competitors.slice(0, 10), // Top 10 competitors
      analysis: {
        totalCompetitors: competitors.length,
        priceRange: analyzePriceRange(competitors),
        averageRating: calculateAverageRating(competitors),
        commonFeatures: extractCommonFeatures(competitors),
        marketInsights: generateMarketInsights(competitors, userProductData),
      },
      timestamp: new Date().toISOString(),
    };

    // Save the competitor analysis data
    await saveJobData(jobId, 'amazon_competitors', competitorAnalysis);

    console.log(`Amazon competitor analysis completed for job ${jobId}`);

    return NextResponse.json({
      success: true,
      message: 'Amazon competitor analysis completed',
      data: competitorAnalysis,
    });

  } catch (error) {
    console.error('Amazon competitor analysis error:', error);
    
    try {
      const { jobId } = await request.json();
      if (jobId) {
        await updateJobStatus(jobId, 'failed');
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Amazon competitor analysis failed', details: errorMessage },
      { status: 500 }
    );
  }
}

function analyzePriceRange(competitors: any[]): { min: number; max: number; average: number } {
  const prices = competitors
    .map(comp => parseFloat(comp.price?.replace(/[^0-9.]/g, '') || '0'))
    .filter(price => price > 0);

  if (prices.length === 0) {
    return { min: 0, max: 0, average: 0 };
  }

  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
  };
}

function calculateAverageRating(competitors: any[]): number {
  const ratings = competitors
    .map(comp => parseFloat(comp.rating?.match(/[\d.]+/)?.[0] || '0'))
    .filter(rating => rating > 0);

  if (ratings.length === 0) return 0;
  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

function extractCommonFeatures(competitors: any[]): string[] {
  const allTitles = competitors.map(comp => comp.title || '').join(' ').toLowerCase();
  const words = allTitles.split(/\s+/).filter(word => word.length > 3);
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

function generateMarketInsights(competitors: any[], userProduct: ProductInfo | null): string[] {
  const insights = [];
  
  if (competitors.length > 0) {
    insights.push(`Found ${competitors.length} direct competitors in the market`);
  }
  
  const priceRange = analyzePriceRange(competitors);
  if (priceRange.average > 0) {
    insights.push(`Average competitor price: $${priceRange.average.toFixed(2)}`);
    insights.push(`Price range: $${priceRange.min.toFixed(2)} - $${priceRange.max.toFixed(2)}`);
  }
  
  const avgRating = calculateAverageRating(competitors);
  if (avgRating > 0) {
    insights.push(`Average competitor rating: ${avgRating.toFixed(1)} stars`);
  }
  
  return insights;
}
