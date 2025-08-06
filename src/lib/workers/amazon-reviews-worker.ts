import { customAmazonScraper } from '../custom-amazon-scraper';

/**
 * Amazon reviews worker - direct function call version
 * Replaces the HTTP endpoint to avoid timeout issues
 */
export async function amazonReviewsWorker({
  jobId,
  amazonUrl,
  targetKeywords,
  planName = 'Essential'
}: {
  jobId: string;
  amazonUrl: string;
  targetKeywords: string;
  planName?: string;
}) {
  console.log(`🛒 Starting Amazon reviews worker for job ${jobId}`);
  console.log(`📍 Amazon URL: ${amazonUrl}`);
  console.log(`🔍 Keywords: ${targetKeywords}`);
  console.log(`📊 Plan: ${planName}`);

  try {
    if (!amazonUrl || amazonUrl.trim() === '') {
      throw new Error('No Amazon URL provided');
    }

    // Determine review limit based on plan
    const maxReviews = planName === 'Essential' ? 25 : planName === 'Pro' ? 100 : 200;
    console.log(`🛒 Using ${maxReviews} review limit for ${planName} plan`);
    
    const extractionResult = await customAmazonScraper.scrapeAmazonReviews(amazonUrl, maxReviews);
    
    // Transform to match expected format
    const transformedResult = {
      success: extractionResult.success,
      reviews: extractionResult.reviews,
      productInfo: extractionResult.product,
      realReviewsCount: extractionResult.reviews.length,
      extractionFailed: !extractionResult.success,
      metadata: extractionResult.metadata
    };
    
    // Comprehensive analysis
    const analysis = analyzeMultiPageReviews(
      transformedResult.reviews, 
      transformedResult.productInfo, 
      targetKeywords,
      transformedResult.realReviewsCount,
      transformedResult.extractionFailed || false
    );
    
    // Determine if we actually collected meaningful data
    const hasActualData = (
      transformedResult.reviews.length > 0 &&
      analysis.extractionStatus === 'SUCCESS'
    );

    const result = {
      success: true, // Process completed successfully
      hasActualData: hasActualData, // Whether meaningful data was extracted
      dataCollected: hasActualData, // Legacy compatibility
      reviews: transformedResult.reviews,
      analysis: {
        ...analysis,
        hasActualData: hasActualData,
        dataQuality: hasActualData ? 'good' : 'empty_results'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: extractionResult.metadata.extraction_method,
        realReviewsExtracted: transformedResult.realReviewsCount,
        extractionStatus: analysis.extractionStatus,
        dataType: 'amazon_reviews_extraction',
        planName: planName,
        firecrawlUsed: !!process.env.FIRECRAWL_API_KEY,
        hasActualData: hasActualData
      }
    };

    if (hasActualData) {
      console.log(`✅ Amazon reviews completed with data for job ${jobId}`);
      console.log(`📊 Results: ${transformedResult.realReviewsCount} reviews, status: ${analysis.extractionStatus}`);
    } else {
      console.log(`⚠️ Amazon reviews completed but found no meaningful data for job ${jobId}`);
      console.log(`📊 Empty results: ${transformedResult.realReviewsCount} reviews, status: ${analysis.extractionStatus}`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Amazon reviews failed for job ${jobId}:`, error);
    
    // Return failure result instead of throwing to allow pipeline to continue
    return {
      success: false, // Process failed
      hasActualData: false, // No data extracted
      dataCollected: false, // Legacy compatibility
      reviews: [],
      analysis: {
        totalReviews: 0,
        realReviews: 0,
        extractionStatus: 'FAILED',
        hasActualData: false,
        dataQuality: 'failed'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        hasActualData: false
      }
    };
  }
}

function analyzeMultiPageReviews(reviews: any[], productInfo: any, targetKeywords: string, realCount: number, extractionFailed: boolean) {
  const totalReviews = reviews.length;
  
  if (totalReviews === 0 || extractionFailed) {
    return {
      totalReviews: 0,
      realReviews: realCount,
      extractionStatus: extractionFailed ? 'AMAZON_EXTRACTION_FAILED' : 'NO_REVIEWS_FOUND',
      averageRating: 0,
      painPoints: [],
      positives: [],
      customerNeeds: [],
      emotions: {},
      verifiedPurchaseRatio: 0,
      errorMessage: extractionFailed ? 
        'Amazon review extraction failed - unable to access review data' : 
        'No reviews found for this product'
    };
  }
  
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
  const verifiedCount = reviews.filter(r => r.verified).length;
  const verifiedRatio = verifiedCount / totalReviews;
  
  // Combine all review text for analysis
  const allText = reviews.map(r => `${r.title} ${r.text}`).join(' ').toLowerCase();
  
  // Extract comprehensive insights from larger dataset
  const painPoints = extractComprehensivePainPoints(allText);
  const positives = extractComprehensivePositives(allText);
  const customerNeeds = extractComprehensiveNeeds(allText);
  const emotions = analyzeDetailedEmotions(allText);
  
  return {
    totalReviews,
    realReviews: realCount,
    extractionStatus: 'SUCCESS',
    averageRating: Math.round(averageRating * 10) / 10,
    painPoints,
    positives,
    customerNeeds,
    emotions,
    verifiedPurchaseRatio: Math.round(verifiedRatio * 100) / 100,
    productInfo,
    sampleReviews: reviews.slice(0, 5).map(r => ({
      title: r.title,
      rating: r.rating,
      text: r.text.substring(0, 250) + '...',
      verified: r.verified,
      source: r.source
    }))
  };
}

function extractComprehensivePainPoints(text: string): string[] {
  const patterns = [
    /(?:struggled with|suffering from|problem with|issue with|trouble with|difficulty with|can't|unable to|doesn't work|not working|failed to|frustrated by|annoying|disappointing)[\s\w]{20,150}/gi,
    /(?:chronic|constant|persistent|ongoing|daily)[\s\w]{15,120}/gi,
    /(?:tried everything|nothing works|doesn't help|waste of money|poor quality)[\s\w]{10,100}/gi
  ];
  
  const pains: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 15));
  });
  
  return [...new Set(pains)].slice(0, 20);
}

function extractComprehensivePositives(text: string): string[] {
  const patterns = [
    /(?:love|amazing|excellent|perfect|fantastic|wonderful|incredible|impressed|happy|satisfied|recommend|works great|life changing|game changer)[\s\w]{20,150}/gi,
    /(?:best|better than|exceeded expectations|exactly what|worth every|natural|effective|comfortable|quality)[\s\w]{15,120}/gi,
    /(?:sleep better|pain relief|reduced inflammation|more energy|feeling great)[\s\w]{10,100}/gi
  ];
  
  const positives: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    positives.push(...matches.slice(0, 15));
  });
  
  return [...new Set(positives)].slice(0, 20);
}

function extractComprehensiveNeeds(text: string): string[] {
  const patterns = [
    /(?:need|want|looking for|searching for|require|must have|wish|hope for|trying to find|seeking)[\s\w]{15,120}/gi,
    /(?:help with|solution for|way to|method to|hoping to|trying to)[\s\w]{15,100}/gi
  ];
  
  const needs: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    needs.push(...matches.slice(0, 10));
  });
  
  return [...new Set(needs)].slice(0, 15);
}

function analyzeDetailedEmotions(text: string): Record<string, number> {
  const emotions = {
    satisfaction: (text.match(/love|great|amazing|excellent|perfect|satisfied|happy|pleased|impressed/g) || []).length,
    frustration: (text.match(/frustrated|annoying|hate|terrible|awful|disappointed|angry|mad|irritated/g) || []).length,
    excitement: (text.match(/excited|thrilled|amazing|incredible|blown away|awesome|fantastic|wonderful/g) || []).length,
    relief: (text.match(/relief|finally|thank god|godsend|lifesaver|game changer|life changing|breakthrough/g) || []).length,
    skepticism: (text.match(/skeptical|doubt|suspicious|not sure|questionable|unsure|hesitant/g) || []).length,
    gratitude: (text.match(/thank|grateful|appreciate|blessing|thankful|grateful|blessed/g) || []).length,
    hope: (text.match(/hope|hopeful|optimistic|confident|positive|encouraged/g) || []).length,
    pain: (text.match(/pain|hurt|suffering|agony|chronic|inflammation|arthritis|fibromyalgia/g) || []).length
  };
  
  return emotions;
}