import { NextRequest, NextResponse } from 'next/server';
import { customAmazonScraper } from '@/lib/custom-amazon-scraper';
import { customRedditScraper } from '@/lib/custom-reddit-scraper';
import { storeJobResult } from '@/lib/job-cache';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    const testJobId = jobId || 'debug-test-' + Date.now();
    
    console.log(`🧪 Testing custom scrapers for debug job: ${testJobId}`);

    // Test Amazon scraper with a known product
    console.log('🛒 Testing Amazon scraper...');
    const amazonResult = await customAmazonScraper.scrapeAmazonReviews(
      'https://www.amazon.com/dp/B08N5WRWNW', // Example product
      10 // Limited reviews for testing
    );

    // Store Amazon result for debug dashboard
    storeJobResult(testJobId, 'amazon', {
      success: amazonResult.success,
      reviews: amazonResult.reviews,
      metadata: amazonResult.metadata,
      processingTime: amazonResult.metadata.processing_time,
      statusCode: amazonResult.success ? 200 : 500,
      error: amazonResult.error
    });

    // Test Reddit scraper
    console.log('🔍 Testing Reddit scraper...');
    const redditResult = await customRedditScraper.scrapeRedditDiscussions(
      'grounding sheets', // Test keywords
      20 // Limited posts for testing
    );

    // Store Reddit result for debug dashboard
    storeJobResult(testJobId, 'reddit', {
      success: redditResult.success,
      posts: [...redditResult.posts, ...redditResult.comments],
      metadata: redditResult.metadata,
      processingTime: redditResult.metadata.processing_time,
      statusCode: redditResult.success ? 200 : 500,
      error: redditResult.error
    });

    // Simulate website scraper result (using Shopify integration)
    storeJobResult(testJobId, 'website', {
      success: true,
      websiteData: {
        customerReviews: ['Great product!', 'Love these sheets!', 'Amazing quality!'],
        dataQuality: {
          method: 'shopify_scraper'
        }
      },
      analysis: {
        method: 'shopify_scraper',
        reviewsFound: 22
      },
      processingTime: 3500,
      statusCode: 200
    });

    // Simulate persona generator (pending)
    storeJobResult(testJobId, 'persona', {
      success: false,
      status: 'processing',
      processingTime: null,
      error: 'Still processing - waiting for all data sources'
    });

    const testResults = {
      jobId: testJobId,
      amazon: {
        success: amazonResult.success,
        reviewsExtracted: amazonResult.reviews.length,
        method: amazonResult.metadata.extraction_method,
        processingTime: amazonResult.metadata.processing_time,
        costSavings: amazonResult.metadata.cost_savings
      },
      reddit: {
        success: redditResult.success,
        postsExtracted: redditResult.posts.length,
        commentsExtracted: redditResult.comments.length,
        method: redditResult.metadata.extraction_method,
        processingTime: redditResult.metadata.processing_time,
        costSavings: redditResult.metadata.cost_savings
      }
    };

    console.log('✅ Custom scraper test completed:', testResults);

    return NextResponse.json({
      success: true,
      message: 'Custom scrapers tested successfully',
      data: testResults,
      debugUrl: `/debug/${testJobId}`,
      paymentSuccessDebugUrl: `/payment/success?debug=true&job_id=${testJobId}&free=true`
    });

  } catch (error) {
    console.error('❌ Custom scraper test failed:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}