import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

interface Review {
  id: string;
  source: string;
  sourceUrl: string;
  productTitle: string;
  reviewText: string;
  rating: number;
  reviewDate: string;
  reviewerName: string;
  verifiedPurchase: boolean;
  helpfulVotes: number;
}

interface CollectionTarget {
  url: string;
  source: 'user_amazon' | 'competitor_amazon' | 'user_website';
  productTitle: string;
  asin?: string;
}

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { competitors, userProduct, targetKeywords, amazonProductUrl, primaryProductUrl } = payload;
    
    console.log(`Starting review collection for job ${jobId}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing', 15, undefined, undefined);
    
    // Build collection targets
    const collectionTargets: CollectionTarget[] = [];
    
    // Add user's Amazon product
    collectionTargets.push({
      url: amazonProductUrl,
      source: 'user_amazon',
      productTitle: userProduct?.title || 'User Product',
      asin: userProduct?.asin
    });
    
    // Add user's website (if it has reviews)
    collectionTargets.push({
      url: primaryProductUrl,
      source: 'user_website', 
      productTitle: userProduct?.title || 'User Product'
    });
    
    // Add competitor Amazon products (limit to top 5)
    if (competitors && Array.isArray(competitors)) {
      competitors.slice(0, 5).forEach((competitor: any) => {
        collectionTargets.push({
          url: competitor.productUrl,
          source: 'competitor_amazon',
          productTitle: competitor.title,
          asin: competitor.asin
        });
      });
    }
    
    console.log(`Collecting reviews from ${collectionTargets.length} sources`);
    
    // Collect reviews from all sources
    const allReviews: Review[] = [];
    let completedSources = 0;
    
    for (const target of collectionTargets) {
      try {
        console.log(`Collecting reviews from: ${target.productTitle} (${target.source})`);
        
        const reviews = await collectReviewsFromSource(target);
        allReviews.push(...reviews);
        
        completedSources++;
        const progress = 15 + Math.floor((completedSources / collectionTargets.length) * 60);
        await updateJobStatus(jobId, 'processing', progress, undefined, undefined);
        
        // Add delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error collecting reviews from ${target.url}:`, error);
        // Continue with other sources even if one fails
      }
    }
    
    console.log(`Collected ${allReviews.length} total reviews`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 80, undefined, undefined);
    
    // Store raw reviews in database (no analysis here)
    await storeReviews(jobId, allReviews);
    
    // Create basic collection summary (counts only, no sentiment analysis)
    const collectionSummary = {
      totalReviews: allReviews.length,
      reviewsBySource: allReviews.reduce((acc, review) => {
        acc[review.source] = (acc[review.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      reviewsByProduct: allReviews.reduce((acc, review) => {
        acc[review.productTitle] = (acc[review.productTitle] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      dateRange: {
        earliest: allReviews.reduce((earliest, review) => 
          review.reviewDate < earliest ? review.reviewDate : earliest, 
          allReviews[0]?.reviewDate || ''
        ),
        latest: allReviews.reduce((latest, review) => 
          review.reviewDate > latest ? review.reviewDate : latest, 
          allReviews[0]?.reviewDate || ''
        )
      }
    };
    
    console.log('Collection summary:', collectionSummary);
    
    // Queue the persona generator with raw data
    const queue = new JobQueue();
    await queue.addJob(jobId, 'persona-generator', {
      rawReviews: allReviews,
      collectionSummary,
      competitors,
      userProduct,
      targetKeywords
    });
    
    await queue.markTaskCompleted(jobId, 'reviews-collector');
    
    // Mark as completed for now (until we build persona generator)
    await updateJobStatus(jobId, 'completed', 100, undefined, undefined);
    
    console.log(`Review collection completed for job ${jobId}. Collected ${allReviews.length} raw reviews for analysis.`);
    
    return NextResponse.json({
      success: true,
      message: 'Review collection completed',
      reviewsCollected: allReviews.length,
      collectionSummary
    });

  } catch (error) {
    console.error('Review collection error:', error);
    
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      undefined, 
      `Review collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Review collection failed' },
      { status: 500 }
    );
  }
}

async function collectReviewsFromSource(target: CollectionTarget): Promise<Review[]> {
  const reviews: Review[] = [];
  
  try {
    if (target.source === 'user_amazon' || target.source === 'competitor_amazon') {
      // Simulate Amazon review collection - just raw text, no analysis
      const reviewCount = Math.floor(Math.random() * 50) + 10; // 10-60 reviews
      
      for (let i = 0; i < reviewCount; i++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        const review: Review = {
          id: `review_${Math.random().toString(36).substring(2, 12)}`,
          source: target.source,
          sourceUrl: target.url,
          productTitle: target.productTitle,
          reviewText: generateRawReviewText(target.productTitle),
          rating,
          reviewDate: generateRandomDate(),
          reviewerName: generateRandomReviewerName(),
          verifiedPurchase: Math.random() > 0.2, // 80% verified
          helpfulVotes: Math.floor(Math.random() * 20)
        };
        reviews.push(review);
      }
      
    } else if (target.source === 'user_website') {
      // Simulate website review collection
      const reviewCount = Math.floor(Math.random() * 15) + 3; // 3-18 reviews
      
      for (let i = 0; i < reviewCount; i++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        const review: Review = {
          id: `review_${Math.random().toString(36).substring(2, 12)}`,
          source: target.source,
          sourceUrl: target.url,
          productTitle: target.productTitle,
          reviewText: generateRawReviewText(target.productTitle),
          rating,
          reviewDate: generateRandomDate(),
          reviewerName: generateRandomReviewerName(),
          verifiedPurchase: true,
          helpfulVotes: Math.floor(Math.random() * 10)
        };
        reviews.push(review);
      }
    }
    
    console.log(`Collected ${reviews.length} raw reviews from ${target.productTitle}`);
    return reviews;
    
  } catch (error) {
    console.error(`Error collecting reviews from ${target.url}:`, error);
    return [];
  }
}

function generateRawReviewText(productTitle: string): string {
  // Generate more realistic, mixed review text without pre-categorizing sentiment
  const reviewTemplates = [
    "I bought this product last month and have been using it daily. The build quality seems solid and it arrived quickly. Setup was straightforward though the instructions could be clearer. Overall satisfied with the purchase.",
    "This item works as described. The price point is reasonable for what you get. Delivery was on time and packaging was secure. Would consider buying again.",
    "Mixed feelings about this product. Some features work really well, others not so much. Customer service was responsive when I had questions. Worth trying if you need this type of item.",
    "Good value for money. Not the highest quality but gets the job done. Had a minor issue initially but was able to resolve it. Shipping was fast.",
    "Decent product overall. Fits my needs and does what it's supposed to do. Nothing fancy but reliable. Would recommend for basic use.",
    "The product arrived damaged but the replacement process was smooth. Once I got a working unit, it's been performing well. Happy with the customer service.",
    "Works perfectly for my use case. Easy to set up and use. Quality seems good so far though I've only had it a few weeks. Good purchase.",
    "Had high expectations based on reviews but found some disappointing aspects. Still functional and serves its purpose. Might look at alternatives next time.",
    "Solid product with good features. A bit pricey but the quality justifies the cost. Installation was easy and it's been working reliably.",
    "This replaced my old one which broke after years of use. This new one seems more durable and has better features. Time will tell how it holds up."
  ];
  
  return reviewTemplates[Math.floor(Math.random() * reviewTemplates.length)];
}

function generateRandomDate(): string {
  const start = new Date(2023, 0, 1);
  const end = new Date();
  const randomDate = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return randomDate.toISOString().split('T')[0];
}

function generateRandomReviewerName(): string {
  const names = [
    "John D.", "Sarah M.", "Mike R.", "Emma L.", "David W.", "Lisa K.", 
    "Tom B.", "Jessica P.", "Ryan C.", "Amanda S.", "Kevin H.", "Nicole T."
  ];
  return names[Math.floor(Math.random() * names.length)];
}

async function storeReviews(jobId: string, reviews: Review[]) {
  console.log(`Storing ${reviews.length} raw reviews for job ${jobId}`);
  
  // Group reviews by source for logging
  const reviewsBySource = reviews.reduce((acc, review) => {
    acc[review.source] = (acc[review.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Raw reviews by source:', reviewsBySource);
  
  // TODO: Store in database
  // await sql`INSERT INTO reviews (job_id, source, source_url, product_title, review_text, rating, review_date, reviewer_name, verified_purchase, helpful_votes) VALUES ...`
}
