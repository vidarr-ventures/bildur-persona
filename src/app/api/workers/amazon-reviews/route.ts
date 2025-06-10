import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';

interface AmazonReview {
  title: string;
  rating: number;
  text: string;
  verified: boolean;
  date: string;
  reviewer_name: string;
}

async function extractAmazonReviewsSimple(amazonUrl: string): Promise<AmazonReview[]> {
  try {
    console.log(`Extracting Amazon reviews from: ${amazonUrl}`);
    
    // Extract ASIN from Amazon URL
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     amazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     amazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      console.log('Could not extract ASIN from Amazon URL');
      return [];
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    // Quick method: Search social media for Amazon reviews (fast and reliable)
    const socialReviews = await searchSocialAmazonReviews(asin);
    
    console.log(`Found ${socialReviews.length} social Amazon reviews`);
    return socialReviews;

  } catch (error) {
    console.error('Error extracting Amazon reviews:', error);
    return [];
  }
}

async function searchSocialAmazonReviews(asin: string): Promise<AmazonReview[]> {
  try {
    console.log(`Searching social media for Amazon reviews of ASIN: ${asin}`);
    
    const searchQueries = [
      `"${asin}" Amazon review`,
      `amazon.com/dp/${asin} review`
    ];
    
    const socialReviews: AmazonReview[] = [];
    
    // Search Reddit for Amazon reviews (fast method)
    for (const query of searchQueries.slice(0, 2)) { // Limit to 2 queries for speed
      try {
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=10`;
        
        const response = await fetch(redditUrl, {
          headers: {
            'User-Agent': 'ReviewBot/1.0 (by /u/researcher)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.data && data.data.children) {
            for (const post of data.data.children.slice(0, 5)) { // Limit to 5 posts per query
              const postData = post.data;
              
              if (postData.selftext && postData.selftext.length > 50) {
                socialReviews.push({
                  title: postData.title || 'Reddit Review',
                  rating: extractImpliedRating(postData.selftext + ' ' + postData.title),
                  text: postData.selftext,
                  verified: false, // Social media reviews aren't verified purchases
                  date: new Date(postData.created_utc * 1000).toISOString(),
                  reviewer_name: postData.author
                });
              }
            }
          }
        }
      } catch (queryError) {
        console.error(`Error searching for "${query}":`, queryError);
      }
    }
    
    console.log(`Found ${socialReviews.length} social media Amazon reviews`);
    return socialReviews;
  } catch (error) {
    console.error('Error searching social Amazon reviews:', error);
    return [];
  }
}

function extractImpliedRating(text: string): number {
  const lowerText = text.toLowerCase();
  
  // Positive indicators
  const positiveWords = ['love', 'amazing', 'excellent', 'perfect', 'great', 'fantastic', 'recommend'];
  const negativeWords = ['hate', 'terrible', 'awful', 'worst', 'useless', 'disappointed', 'waste'];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveWords.forEach(word => {
    if (lowerText.includes(word)) positiveScore++;
  });
  
  negativeWords.forEach(word => {
    if (lowerText.includes(word)) negativeScore++;
  });
  
  if (positiveScore > negativeScore) return 4;
  if (negativeScore > positiveScore) return 2;
  return 3; // Neutral
}

function analyzeAmazonReviewsSimple(reviews: AmazonReview[]) {
  const totalReviews = reviews.length;
  
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      painPoints: [],
      positives: [],
      customerNeeds: [],
      emotions: {},
      verifiedPurchaseRatio: 0
    };
  }
  
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
  
  // Combine all review text
  const allText = reviews.map(r => `${r.title} ${r.text}`).join(' ').toLowerCase();
  
  // Quick analysis
  const painPoints = extractQuickPainPoints(allText);
  const positives = extractQuickPositives(allText);
  const customerNeeds = extractQuickNeeds(allText);
  
  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    painPoints,
    positives,
    customerNeeds,
    emotions: {
      satisfaction: (allText.match(/love|great|amazing|excellent/g) || []).length,
      frustration: (allText.match(/hate|terrible|awful|disappointed/g) || []).length
    },
    verifiedPurchaseRatio: 0 // Social reviews aren't verified
  };
}

function extractQuickPainPoints(text: string): string[] {
  const patterns = [
    /(?:problem|issue|trouble|difficult|doesn't work|not working|failed)[\s\w]{10,80}/gi
  ];
  
  const pains: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 5));
  });
  
  return [...new Set(pains)].slice(0, 8);
}

function extractQuickPositives(text: string): string[] {
  const patterns = [
    /(?:love|great|amazing|excellent|perfect|recommend|works well)[\s\w]{10,80}/gi
  ];
  
  const positives: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    positives.push(...matches.slice(0, 5));
  });
  
  return [...new Set(positives)].slice(0, 8);
}

function extractQuickNeeds(text: string): string[] {
  const patterns = [
    /(?:need|want|looking for|wish|hope for)[\s\w]{10,60}/gi
  ];
  
  const needs: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    needs.push(...matches.slice(0, 3));
  });
  
  return [...new Set(needs)].slice(0, 6);
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, amazonUrl, targetKeywords } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!amazonUrl) {
      return NextResponse.json({ error: 'Amazon URL is required' }, { status: 400 });
    }

    console.log(`Starting FAST Amazon reviews collection for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Extract Amazon reviews using fast method
    const reviews = await extractAmazonReviewsSimple(amazonUrl);
    
    // Analyze reviews
    const analysis = analyzeAmazonReviewsSimple(reviews);
    
    const amazonReviewsData = {
      reviews: reviews,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: 'social_fast',
        dataType: 'amazon_reviews'
      }
    };

    await saveJobData(jobId, 'amazon_reviews', amazonReviewsData);

    console.log(`FAST Amazon reviews collection completed for job ${jobId}. Found ${reviews.length} reviews`);

    return NextResponse.json({
      success: true,
      message: 'Amazon reviews collection completed (fast method)',
      data: {
        reviewCount: reviews.length,
        averageRating: analysis.averageRating,
        painPointsFound: analysis.painPoints.length,
        positivesFound: analysis.positives.length,
        method: 'social_fast'
      }
    });

  } catch (error) {
    console.error('Amazon reviews collection error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Amazon reviews collection failed', details: errorMessage },
      { status: 500 }
    );
  }
}
