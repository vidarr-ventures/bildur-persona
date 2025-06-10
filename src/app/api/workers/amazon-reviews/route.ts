// src/app/api/workers/amazon-reviews/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';

interface AmazonReview {
  title: string;
  rating: number;
  text: string;
  verified: boolean;
  helpful_votes: number;
  date: string;
  reviewer_name: string;
  vine_customer: boolean;
}

interface ReviewAnalysis {
  totalReviews: number;
  averageRating: number;
  ratingDistribution: Record<string, number>;
  commonPhrases: string[];
  painPoints: string[];
  positives: string[];
  customerNeeds: string[];
  emotions: Record<string, number>;
  verifiedPurchaseRatio: number;
}

async function extractAmazonReviews(amazonUrl: string): Promise<AmazonReview[]> {
  try {
    console.log(`Extracting Amazon reviews from: ${amazonUrl}`);
    
    // Extract ASIN from Amazon URL
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     amazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     amazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    // Method 1: Try ScrapeOwl with Amazon reviews page
    const reviewsUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?reviewerType=all_reviews&sortBy=recent&pageNumber=1`;
    
    try {
      const scrapeResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: process.env.SCRAPEOWL_API_KEY,
          url: reviewsUrl,
          render_js: true,
          elements: [
            { 
              name: 'reviews', 
              selector: '[data-hook="review"]',
              multiple: true,
              children: [
                { name: 'title', selector: '[data-hook="review-title"] span:last-child' },
                { name: 'rating', selector: '[data-hook="review-star-rating"] span', attribute: 'class' },
                { name: 'text', selector: '[data-hook="review-body"] span' },
                { name: 'verified', selector: '[data-hook="avp-badge"]' },
                { name: 'helpful', selector: '[data-hook="helpful-vote-statement"]' },
                { name: 'date', selector: '[data-hook="review-date"]' },
                { name: 'reviewer', selector: '.a-profile-name' },
                { name: 'vine', selector: '[data-hook="vine-customer-review"]' }
              ]
            }
          ],
        }),
      });

      if (scrapeResponse.ok) {
        const data = await scrapeResponse.json();
        const reviews = parseAmazonReviews(data.reviews || []);
        
        if (reviews.length > 0) {
          console.log(`Successfully extracted ${reviews.length} reviews via ScrapeOwl`);
          return reviews;
        }
      }
    } catch (scrapeError) {
      console.log('ScrapeOwl method failed, trying alternative approaches');
    }

    // Method 2: Try Amazon API approach (if available)
    try {
      const amazonApiReviews = await fetchAmazonAPIReviews(asin);
      if (amazonApiReviews.length > 0) {
        return amazonApiReviews;
      }
    } catch (apiError) {
      console.log('Amazon API approach failed');
    }

    // Method 3: Search for Amazon reviews on Reddit/social media
    const socialReviews = await searchSocialAmazonReviews(asin);
    return socialReviews;

  } catch (error) {
    console.error('Error extracting Amazon reviews:', error);
    return [];
  }
}

function parseAmazonReviews(rawReviews: any[]): AmazonReview[] {
  return rawReviews.map(review => {
    // Parse rating from class name (e.g., "a-icon a-icon-star a-star-5")
    const ratingMatch = review.rating?.match(/a-star-(\d)/);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 0;
    
    // Parse helpful votes
    const helpfulMatch = review.helpful?.match(/(\d+)/);
    const helpfulVotes = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;
    
    return {
      title: review.title || '',
      rating: rating,
      text: review.text || '',
      verified: !!review.verified,
      helpful_votes: helpfulVotes,
      date: review.date || '',
      reviewer_name: review.reviewer || 'Anonymous',
      vine_customer: !!review.vine
    };
  }).filter(review => review.text && review.text.length > 10);
}

async function fetchAmazonAPIReviews(asin: string): Promise<AmazonReview[]> {
  // This would require Amazon API access or third-party review APIs
  // For now, return empty array but structure is ready for integration
  return [];
}

async function searchSocialAmazonReviews(asin: string): Promise<AmazonReview[]> {
  try {
    console.log(`Searching social media for Amazon reviews of ASIN: ${asin}`);
    
    const searchQueries = [
      `"${asin}" Amazon review`,
      `amazon.com/dp/${asin} review`,
      `"bought this on Amazon" "${asin}"`
    ];
    
    const socialReviews: AmazonReview[] = [];
    
    for (const query of searchQueries) {
      try {
        // Search Reddit for Amazon reviews
        const redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=20`;
        
        const response = await fetch(redditUrl, {
          headers: {
            'User-Agent': 'ReviewBot/1.0 (by /u/researcher)'
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.data && data.data.children) {
            for (const post of data.data.children) {
              const postData = post.data;
              
              if (postData.selftext && postData.selftext.length > 50) {
                socialReviews.push({
                  title: postData.title,
                  rating: extractImpliedRating(postData.selftext + ' ' + postData.title),
                  text: postData.selftext,
                  verified: false, // Social media reviews aren't verified purchases
                  helpful_votes: postData.ups || 0,
                  date: new Date(postData.created_utc * 1000).toISOString(),
                  reviewer_name: postData.author,
                  vine_customer: false
                });
              }
            }
          }
        }
      } catch (queryError) {
        console.error(`Error searching for "${query}":`, queryError);
      }
    }
    
    console.log(`Found ${socialReviews.length} social media reviews`);
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

function analyzeAmazonReviews(reviews: AmazonReview[]): ReviewAnalysis {
  const totalReviews = reviews.length;
  
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: {},
      commonPhrases: [],
      painPoints: [],
      positives: [],
      customerNeeds: [],
      emotions: {},
      verifiedPurchaseRatio: 0
    };
  }
  
  // Calculate rating distribution
  const ratingCounts = reviews.reduce((acc, review) => {
    const rating = review.rating.toString();
    acc[rating] = (acc[rating] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
  
  // Combine all review text
  const allText = reviews.map(r => `${r.title} ${r.text}`).join(' ').toLowerCase();
  
  // Extract insights
  const painPoints = extractPainPoints(allText);
  const positives = extractPositives(allText);
  const customerNeeds = extractCustomerNeeds(allText);
  const commonPhrases = extractCommonPhrases(allText);
  const emotions = analyzeEmotions(allText);
  
  const verifiedReviews = reviews.filter(r => r.verified).length;
  const verifiedPurchaseRatio = verifiedReviews / totalReviews;
  
  return {
    totalReviews,
    averageRating: Math.round(averageRating * 10) / 10,
    ratingDistribution: ratingCounts,
    commonPhrases,
    painPoints,
    positives,
    customerNeeds,
    emotions,
    verifiedPurchaseRatio: Math.round(verifiedPurchaseRatio * 100) / 100
  };
}

function extractPainPoints(text: string): string[] {
  const painPatterns = [
    /(?:problem|issue|trouble|difficult|hard|annoying|frustrating|struggling|can't|unable to|doesn't work|not working|failed|broken)[\s\w]{10,100}/gi,
    /(?:wish|hope|would be better if|needs improvement|could be|should have)[\s\w]{10,80}/gi
  ];
  
  const pains: string[] = [];
  painPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 10));
  });
  
  return [...new Set(pains)].slice(0, 15);
}

function extractPositives(text: string): string[] {
  const positivePatterns = [
    /(?:love|great|amazing|excellent|perfect|fantastic|wonderful|impressed|happy|satisfied|recommend|works well|quality|comfortable)[\s\w]{10,100}/gi,
    /(?:best|better than|exceeded expectations|exactly what|worth it)[\s\w]{10,80}/gi
  ];
  
  const positives: string[] = [];
  positivePatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    positives.push(...matches.slice(0, 10));
  });
  
  return [...new Set(positives)].slice(0, 15);
}

function extractCustomerNeeds(text: string): string[] {
  const needPatterns = [
    /(?:need|want|looking for|searching for|require|must have|wish|hope for)[\s\w]{10,100}/gi,
    /(?:help|solution|fix|improve|better)[\s\w]{10,80}/gi
  ];
  
  const needs: string[] = [];
  needPatterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    needs.push(...matches.slice(0, 10));
  });
  
  return [...new Set(needs)].slice(0, 15);
}

function extractCommonPhrases(text: string): string[] {
  const words = text.split(/\s+/)
    .map(word => word.replace(/[^\w]/g, '').toLowerCase())
    .filter(word => word.length > 3 && word.length < 20);
    
  const wordCounts = words.reduce((acc, word) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  return Object.entries(wordCounts)
    .filter(([word, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([word]) => word);
}

function analyzeEmotions(text: string): Record<string, number> {
  const emotionKeywords = {
    satisfaction: ['love', 'great', 'amazing', 'excellent', 'recommend', 'perfect', 'happy', 'satisfied'],
    frustration: ['frustrated', 'annoying', 'hate', 'terrible', 'awful', 'disappointed', 'angry'],
    excitement: ['excited', 'thrilled', 'amazing', 'incredible', 'blown away', 'awesome'],
    disappointment: ['disappointed', 'expected more', 'not what', 'waste', 'regret'],
    relief: ['relief', 'finally', 'thank god', 'godsend', 'lifesaver', 'game changer']
  };
  
  return Object.keys(emotionKeywords).reduce((acc, emotion) => {
    const keywords = emotionKeywords[emotion as keyof typeof emotionKeywords];
    acc[emotion] = keywords.reduce((count, keyword) => {
      return count + (text.match(new RegExp(keyword, 'g')) || []).length;
    }, 0);
    return acc;
  }, {} as Record<string, number>);
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

    console.log(`Starting Amazon reviews collection for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Extract Amazon reviews
    const reviews = await extractAmazonReviews(amazonUrl);
    
    if (reviews.length === 0) {
      console.log('No Amazon reviews found');
      await saveJobData(jobId, 'amazon_reviews', {
        reviews: [],
        analysis: { message: 'No Amazon reviews found for this product' },
        metadata: { timestamp: new Date().toISOString(), amazonUrl }
      });
      
      return NextResponse.json({
        success: true,
        message: 'Amazon reviews collection completed (no reviews found)',
        data: { reviewCount: 0 }
      });
    }

    // Analyze reviews
    const analysis = analyzeAmazonReviews(reviews);
    
    const amazonReviewsData = {
      reviews: reviews,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: 'scrapeowl_and_social',
        dataType: 'amazon_reviews'
      }
    };

    await saveJobData(jobId, 'amazon_reviews', amazonReviewsData);

    console.log(`Amazon reviews collection completed for job ${jobId}. Found ${reviews.length} reviews with average rating ${analysis.averageRating}`);

    return NextResponse.json({
      success: true,
      message: 'Amazon reviews collection completed',
      data: {
        reviewCount: reviews.length,
        averageRating: analysis.averageRating,
        verifiedPurchaseRatio: analysis.verifiedPurchaseRatio,
        painPointsFound: analysis.painPoints.length,
        positivesFound: analysis.positives.length,
        emotions: analysis.emotions
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
