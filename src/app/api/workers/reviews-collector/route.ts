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
        const progress = 15 + Math.floor((completedSources / collectionTargets.length) * 50);
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
    await updateJobStatus(jobId, 'processing', 70, undefined, undefined);
    
    // Process and analyze reviews
    const processedReviews = await processReviews(allReviews);
    
    // Store reviews in database
    await storeReviews(jobId, processedReviews);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 85, undefined, undefined);
    
    // Generate summary insights
    const reviewInsights = generateReviewInsights(processedReviews);
    
    console.log('Review insights:', reviewInsights);
    
    // Queue the next worker (persona generator)
    const queue = new JobQueue();
    await queue.addJob(jobId, 'persona-generator', {
      reviews: processedReviews,
      reviewInsights,
      competitors,
      userProduct,
      targetKeywords
    });
    
    await queue.markTaskCompleted(jobId, 'reviews-collector');
    
    // Mark as completed for now (until we build persona generator)
    await updateJobStatus(jobId, 'completed', 100, undefined, undefined);
    
    console.log(`Review collection completed for job ${jobId}. Found ${allReviews.length} reviews.`);
    
    return NextResponse.json({
      success: true,
      message: 'Review collection completed',
      reviewsCollected: allReviews.length,
      insights: reviewInsights
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
      // Simulate Amazon review collection
      const reviewCount = Math.floor(Math.random() * 50) + 10; // 10-60 reviews
      
      for (let i = 0; i < reviewCount; i++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        const review: Review = {
          id: `review_${Math.random().toString(36).substring(2, 12)}`,
          source: target.source,
          sourceUrl: target.url,
          productTitle: target.productTitle,
          reviewText: generateSampleReviewText(rating, target.productTitle),
          rating,
          reviewDate: generateRandomDate(),
          reviewerName: generateRandomReviewerName(),
          verifiedPurchase: Math.random() > 0.2, // 80% verified
          helpfulVotes: Math.floor(Math.random() * 20)
        };
        reviews.push(review);
      }
      
    } else if (target.source === 'user_website') {
      // Simulate website review collection (usually fewer reviews)
      const reviewCount = Math.floor(Math.random() * 15) + 3; // 3-18 reviews
      
      for (let i = 0; i < reviewCount; i++) {
        const rating = Math.floor(Math.random() * 5) + 1;
        const review: Review = {
          id: `review_${Math.random().toString(36).substring(2, 12)}`,
          source: target.source,
          sourceUrl: target.url,
          productTitle: target.productTitle,
          reviewText: generateSampleReviewText(rating, target.productTitle),
          rating,
          reviewDate: generateRandomDate(),
          reviewerName: generateRandomReviewerName(),
          verifiedPurchase: true, // Website reviews are usually verified
          helpfulVotes: Math.floor(Math.random() * 10)
        };
        reviews.push(review);
      }
    }
    
    console.log(`Collected ${reviews.length} reviews from ${target.productTitle}`);
    return reviews;
    
  } catch (error) {
    console.error(`Error collecting reviews from ${target.url}:`, error);
    return [];
  }
}

function generateSampleReviewText(rating: number, productTitle: string): string {
  const positiveReviews = [
    "Great product! Exactly what I was looking for. Fast delivery and excellent quality.",
    "Love this item! Works perfectly and exceeded my expectations. Highly recommend.",
    "Fantastic purchase. The quality is outstanding and it arrived quickly.",
    "Perfect! This product does exactly what it promises. Very satisfied with my purchase.",
    "Excellent value for money. Great quality and fantastic customer service."
  ];
  
  const neutralReviews = [
    "Good product overall. A few minor issues but generally satisfied.",
    "Decent quality for the price. Could be better but it works as expected.",
    "It's okay. Does what it's supposed to do but nothing exceptional.",
    "Average product. Works fine but I've seen better alternatives.",
    "Not bad, but not great either. It serves its purpose adequately."
  ];
  
  const negativeReviews = [
    "Disappointed with this purchase. The quality is not as advertised.",
    "Had high hopes but this product didn't meet my expectations.",
    "Poor quality materials. Broke after just a few uses.",
    "Not worth the money. There are much better alternatives available.",
    "Terrible experience. Product arrived damaged and customer service was unhelpful."
  ];
  
  if (rating >= 4) {
    return positiveReviews[Math.floor(Math.random() * positiveReviews.length)];
  } else if (rating >= 3) {
    return neutralReviews[Math.floor(Math.random() * neutralReviews.length)];
  } else {
    return negativeReviews[Math.floor(Math.random() * negativeReviews.length)];
  }
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

async function processReviews(reviews: Review[]): Promise<Review[]> {
  // In a real implementation, you would:
  // 1. Clean and normalize review text
  // 2. Remove spam/fake reviews
  // 3. Extract key phrases and sentiments
  // 4. Categorize by themes
  
  console.log(`Processing ${reviews.length} reviews...`);
  
  // For now, just return the reviews as-is
  return reviews;
}

async function storeReviews(jobId: string, reviews: Review[]) {
  console.log(`Storing ${reviews.length} reviews for job ${jobId}`);
  
  // Group reviews by source for logging
  const reviewsBySource = reviews.reduce((acc, review) => {
    acc[review.source] = (acc[review.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Reviews by source:', reviewsBySource);
  
  // TODO: Store in database
  // await sql`INSERT INTO reviews (job_id, source, source_url, product_title, review_text, rating, review_date, reviewer_name, verified_purchase, helpful_votes) VALUES ...`
}

function generateReviewInsights(reviews: Review[]) {
  const totalReviews = reviews.length;
  const averageRating = reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews;
  
  const ratingDistribution = {
    1: reviews.filter(r => r.rating === 1).length,
    2: reviews.filter(r => r.rating === 2).length,
    3: reviews.filter(r => r.rating === 3).length,
    4: reviews.filter(r => r.rating === 4).length,
    5: reviews.filter(r => r.rating === 5).length,
  };
  
  const sourceBreakdown = reviews.reduce((acc, review) => {
    acc[review.source] = (acc[review.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const verifiedPurchaseRate = reviews.filter(r => r.verifiedPurchase).length / totalReviews;
  
  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution,
    sourceBreakdown,
    verifiedPurchaseRate: Math.round(verifiedPurchaseRate * 100),
    sentimentSummary: {
      positive: reviews.filter(r => r.rating >= 4).length,
      neutral: reviews.filter(r => r.rating === 3).length,
      negative: reviews.filter(r => r.rating <= 2).length
    }
  };
}
