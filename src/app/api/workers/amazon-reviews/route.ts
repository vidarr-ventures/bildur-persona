import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { customAmazonScraper } from '@/lib/custom-amazon-scraper';
import { storeJobResult } from '@/lib/job-cache';

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

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const requestBody = await request.json(); // Store once, use everywhere
    console.log('=== AMAZON WORKER FULL REQUEST DEBUG ===');
    console.log('Full request body received:', JSON.stringify(requestBody, null, 2));
    
    const { jobId, amazonUrl, targetKeywords, planName } = requestBody;

    // Debug: Log what we received
    console.log('=== AMAZON WORKER EXTRACTED VALUES DEBUG ===');
    console.log('Job ID:', jobId);
    console.log('Amazon URL received:', amazonUrl);
    console.log('Amazon URL type:', typeof amazonUrl);
    console.log('Amazon URL length:', amazonUrl?.length);
    console.log('Amazon URL is empty string:', amazonUrl === '');
    console.log('Amazon URL is null:', amazonUrl === null);
    console.log('Amazon URL is undefined:', amazonUrl === undefined);
    console.log('Target keywords:', targetKeywords);
    console.log('Plan name:', planName);

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!amazonUrl || amazonUrl.trim() === '') {
      console.log('=== AMAZON WORKER: NO URL PROVIDED ===');
      console.log('Amazon URL is null/undefined:', amazonUrl === null || amazonUrl === undefined);
      console.log('Amazon URL is empty string:', amazonUrl === '');
      console.log('Amazon URL after trim is empty:', amazonUrl?.trim() === '');
      console.log('Full request body was:', JSON.stringify(requestBody, null, 2));
      console.log('=== END AMAZON WORKER DEBUG ===');
      
      return NextResponse.json({ 
        success: true, 
        message: 'No Amazon URL provided - skipping Amazon analysis',
        data: { 
          reviewCount: 0, 
          method: 'skipped',
          debugInfo: {
            receivedAmazonUrl: amazonUrl,
            amazonUrlType: typeof amazonUrl,
            amazonUrlLength: amazonUrl?.length,
            requestBodyKeys: Object.keys(requestBody)
          }
        }
      });
    }

    console.log(`Starting Amazon reviews extraction for job ${jobId} (${planName} tier)`);
    
    try {
      await updateJobStatus(jobId, 'processing');
    } catch (dbError) {
      console.log('updateJobStatus failed (continuing anyway):', dbError);
    }
    
    // Custom Amazon scraper with tier-based limits
    const maxReviews = planName === 'Essential' ? 25 : planName === 'Pro' ? 100 : 200;
    console.log(`🛒 Using custom Amazon scraper with ${maxReviews} review limit for ${planName} plan`);
    
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
    
    // Store result in cache for debug dashboard
    storeJobResult(jobId, 'amazon', {
      success: transformedResult.reviews.length > 0,
      reviews: transformedResult.reviews,
      analysis: analysis,
      metadata: transformedResult.metadata,
      processingTime: transformedResult.metadata.processing_time,
      statusCode: transformedResult.reviews.length > 0 ? 200 : 404,
      error: transformedResult.reviews.length === 0 ? 'No Amazon reviews found' : extractionResult.error,
      hasActualData: transformedResult.reviews.length > 0,
      dataCollected: transformedResult.reviews.length > 0
    });
    
    const amazonReviewsData = {
      reviews: transformedResult.reviews,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: extractionResult.metadata.extraction_method,
        realReviewsExtracted: transformedResult.realReviewsCount,
        extractionStatus: analysis.extractionStatus,
        dataType: 'amazon_reviews_extraction',
        planName: planName || 'Essential',
        firecrawlUsed: !!process.env.FIRECRAWL_API_KEY
      }
    };

    try {
      await saveJobData(jobId, 'amazon_reviews', amazonReviewsData);
    } catch (dbError) {
      console.log('saveJobData failed (continuing anyway):', dbError);
    }

    console.log(`Amazon extraction completed for job ${jobId}:`);
    console.log(`- Plan: ${planName || 'Essential'}`);
    console.log(`- Real reviews extracted: ${transformedResult.realReviewsCount}`);
    console.log(`- Extraction method: ${extractionResult.metadata.extraction_method}`);
    console.log(`- Extraction status: ${analysis.extractionStatus}`);

    return NextResponse.json({
      success: extractionResult.reviews.length > 0, // Changed: success based on actual data found
      message: analysis.extractionStatus === 'SUCCESS' ? 
        `Amazon reviews extraction completed successfully (${planName} tier)` : 
        `Amazon reviews extraction completed with issues (${planName} tier)`,
      data: {
        totalReviews: extractionResult.reviews.length,
        realReviews: transformedResult.realReviewsCount,
        extractionStatus: analysis.extractionStatus,
        averageRating: analysis.averageRating,
        verifiedRatio: analysis.verifiedPurchaseRatio,
        painPointsFound: analysis.painPoints.length,
        positivesFound: analysis.positives.length,
        method: extractionResult.metadata.extraction_method,
        planName: planName || 'Essential',
        emotions: analysis.emotions,
        errorMessage: analysis.errorMessage
      },
      hasActualData: extractionResult.reviews.length > 0,
      dataCollected: extractionResult.reviews.length > 0
    });

  } catch (error) {
    console.error('Amazon reviews extraction error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Amazon reviews extraction failed', details: errorMessage },
      { status: 500 }
    );
  }
}