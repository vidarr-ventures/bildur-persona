import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';

async function extractMultiPageAmazonReviews(amazonUrl: string, targetKeywords: string) {
  try {
    console.log(`Multi-page Amazon extraction from: ${amazonUrl}`);
    
    // Extract ASIN
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     amazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     amazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    let allReviews: any[] = [];
    let productInfo: any = {};
    
    // Try ScrapeOwl with multiple pages
    if (process.env.SCRAPEOWL_API_KEY) {
      console.log('Attempting multi-page ScrapeOwl extraction...');
      
      // Extract from ALL available pages - no artificial limit
      const maxPagesToScrape = 100; // Safety limit to prevent infinite loops
      
      for (let page = 1; page <= maxPagesToScrape; page++) {
        try {
          console.log(`Scraping Amazon reviews page ${page}...`);
          
          const reviewUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?reviewerType=all_reviews&sortBy=recent&pageNumber=${page}`;
          
          const scrapeResponse = await fetch('https://api.scrapeowl.com/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              api_key: process.env.SCRAPEOWL_API_KEY,
              url: reviewUrl,
              render_js: true,
              wait_for: 3000, // Wait 3 seconds for content to load
              elements: [
                { 
                  name: 'reviews', 
                  selector: '[data-hook="review"]',
                  multiple: true,
                  children: [
                    { name: 'title', selector: '[data-hook="review-title"] span:not(.cr-original-review-text)' },
                    { name: 'rating', selector: '[data-hook="review-star-rating"] span', attribute: 'class' },
                    { name: 'text', selector: '[data-hook="review-body"] span' },
                    { name: 'verified', selector: '[data-hook="avp-badge"]' },
                    { name: 'helpful', selector: '[data-hook="helpful-vote-statement"]' },
                    { name: 'date', selector: '[data-hook="review-date"]' },
                    { name: 'reviewer', selector: '.a-profile-name' }
                  ]
                },
                // Only get product info on first page
                ...(page === 1 ? [
                  { name: 'product_title', selector: 'h1, .product-title, [data-hook="product-link"]' },
                  { name: 'overall_rating', selector: '[data-hook="rating-out-of-text"]' },
                  { name: 'total_reviews', selector: '[data-hook="total-review-count"]' }
                ] : [])
              ],
            }),
          });

          if (scrapeResponse.ok) {
            const data = await scrapeResponse.json();
            console.log(`Page ${page}: Found ${data.reviews?.length || 0} reviews`);
            
            if (page === 1) {
              // Extract product info from first page
              productInfo = {
                title: data.product_title || 'Unknown Product',
                overallRating: data.overall_rating || 'Unknown',
                totalReviews: data.total_reviews || 'Unknown',
                asin: asin
              };
              
              console.log(`Product: ${productInfo.title}, Total Reviews: ${productInfo.totalReviews}`);
            }
            
            // Parse reviews from this page
            const pageReviews = (data.reviews || []).map((review: any) => {
              // Extract rating from class name
              const ratingMatch = review.rating?.match(/a-star-(\d)/);
              const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;
              
              // Parse helpful votes
              const helpfulMatch = review.helpful?.match(/(\d+)/);
              const helpfulVotes = helpfulMatch ? parseInt(helpfulMatch[1]) : 0;
              
              return {
                title: review.title || '',
                text: review.text || '',
                rating: rating,
                verified: !!review.verified,
                helpful_votes: helpfulVotes,
                date: review.date || '',
                reviewer_name: review.reviewer || 'Anonymous',
                source: 'amazon_scrapeowl',
                page: page
              };
            }).filter((review: any) => review.text && review.text.length > 15);
            
            allReviews = allReviews.concat(pageReviews);
            console.log(`Total reviews collected so far: ${allReviews.length}`);
            
            // If we got less than 3 reviews on this page, we've reached the end
            if (pageReviews.length < 3) {
              console.log(`Only ${pageReviews.length} reviews on page ${page}, reached end of reviews`);
              break;
            }
            
            // Add delay between requests to avoid rate limiting
            if (page < maxPagesToScrape) {
              await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
            }
            
          } else {
            console.log(`Page ${page} failed with status ${scrapeResponse.status}`);
            // If first page fails, break. If later page fails, continue
            if (page === 1) break;
          }
          
        } catch (pageError) {
          console.error(`Error scraping page ${page}:`, pageError);
          // Continue with next page
        }
      }
      
      console.log(`ScrapeOwl multi-page extraction completed: ${allReviews.length} total reviews`);
    }
    
    // Don't add fake reviews - just report what we actually extracted
    console.log(`Amazon extraction completed: ${allReviews.length} real reviews extracted`);
    
    return {
      reviews: allReviews,
      productInfo: productInfo,
      extractionMethod: allReviews.length > 0 ? 'multi_page_scrapeowl' : 'extraction_failed',
      realReviewsCount: allReviews.length,
      extractionFailed: allReviews.length === 0
    };
    
  } catch (error) {
    console.error('Error in multi-page Amazon extraction:', error);
    return {
      reviews: [],
      productInfo: {},
      extractionMethod: 'extraction_failed',
      realReviewsCount: 0,
      extractionFailed: true
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

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const requestBody = await request.json();
    console.log('=== AMAZON WORKER FULL REQUEST DEBUG ===');
    console.log('Full request body received:', JSON.stringify(requestBody, null, 2));
    
    const { jobId, amazonUrl, targetKeywords } = requestBody;

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

    console.log(`Starting Amazon reviews extraction for job ${jobId}`);
    
    // TEMPORARILY DISABLED: await updateJobStatus(jobId, 'processing');
    
    // Multi-page extraction
    const extractionResult = await extractMultiPageAmazonReviews(amazonUrl, targetKeywords);
    
    // Comprehensive analysis
    const analysis = analyzeMultiPageReviews(
      extractionResult.reviews, 
      extractionResult.productInfo, 
      targetKeywords,
      extractionResult.realReviewsCount,
      extractionResult.extractionFailed || false
    );
    
    const amazonReviewsData = {
      reviews: extractionResult.reviews,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        amazonUrl: amazonUrl,
        targetKeywords: targetKeywords,
        extractionMethod: extractionResult.extractionMethod,
        realReviewsExtracted: extractionResult.realReviewsCount,
        extractionStatus: analysis.extractionStatus,
        dataType: 'amazon_reviews_extraction',
        scrapeOwlUsed: !!process.env.SCRAPEOWL_API_KEY
      }
    };

    // TEMPORARILY DISABLED: await saveJobData(jobId, 'amazon_reviews', amazonReviewsData);

    console.log(`Amazon extraction completed for job ${jobId}:`);
    console.log(`- Real reviews extracted: ${extractionResult.realReviewsCount}`);
    console.log(`- Extraction status: ${analysis.extractionStatus}`);

    return NextResponse.json({
      success: true,
      message: analysis.extractionStatus === 'SUCCESS' ? 
        'Amazon reviews extraction completed successfully' : 
        'Amazon reviews extraction completed with issues',
      data: {
        totalReviews: extractionResult.reviews.length,
        realReviews: extractionResult.realReviewsCount,
        extractionStatus: analysis.extractionStatus,
        averageRating: analysis.averageRating,
        verifiedRatio: analysis.verifiedPurchaseRatio,
        painPointsFound: analysis.painPoints.length,
        positivesFound: analysis.positives.length,
        method: extractionResult.extractionMethod,
        emotions: analysis.emotions,
        errorMessage: analysis.errorMessage
      }
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
