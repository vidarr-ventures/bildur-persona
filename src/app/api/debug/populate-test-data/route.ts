import { NextRequest, NextResponse } from 'next/server';
import { storeJobResult } from '@/lib/job-cache';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    const testJobId = jobId || 'eb904fca-ee65-46af-af16-499712b2b6ea';
    
    console.log(`🧪 Populating test data for debug job: ${testJobId}`);

    // Populate Amazon scraper result
    storeJobResult(testJobId, 'amazon', {
      success: true,
      reviews: [
        { id: '1', text: 'Great product, exactly as described!', rating: 5, reviewer: 'John D.' },
        { id: '2', text: 'Good quality, fast shipping', rating: 4, reviewer: 'Sarah M.' },
        { id: '3', text: 'Love these sheets, very comfortable', rating: 5, reviewer: 'Mike R.' }
      ],
      analysis: {
        method: 'custom_amazon_scraper',
        reviewsFound: 3
      },
      metadata: {
        extraction_method: 'custom_amazon_scraper',
        processing_time: 4500,
        cost_savings: 'Eliminated Firecrawl costs (~$1.50 per job)'
      },
      processingTime: 4500,
      statusCode: 200
    });

    // Populate Reddit scraper result
    storeJobResult(testJobId, 'reddit', {
      success: true,
      posts: [
        { title: 'Anyone tried grounding sheets?', content: 'Thinking about getting some...', score: 15 },
        { title: 'Review: GroundLuxe sheets', content: 'Been using for 3 months, definitely notice better sleep', score: 23 }
      ],
      metadata: {
        extraction_method: 'custom_reddit_scraper',
        processing_time: 3200,
        cost_savings: 'Eliminated Firecrawl costs (~$0.80 per job)',
        subreddits_searched: ['sleep', 'BuyItForLife', 'reviews']
      },
      processingTime: 3200,
      statusCode: 200
    });

    // Populate Website crawler result (Shopify)
    storeJobResult(testJobId, 'website', {
      success: true,
      websiteData: {
        customerReviews: [
          'These sheets changed my sleep quality completely!',
          'Amazing product, highly recommend',
          'Best investment I made for my health'
        ],
        dataQuality: {
          method: 'shopify_scraper'
        }
      },
      analysis: {
        method: 'shopify_scraper',
        reviewsFound: 22,
        firecrawlUsed: false
      },
      processingTime: 2800,
      statusCode: 200
    });

    // Populate YouTube Comments (completed)
    storeJobResult(testJobId, 'youtube', {
      success: true,
      comments: [
        { text: 'Great video about grounding!', likes: 45 },
        { text: 'I use these sheets and love them', likes: 23 }
      ],
      metadata: {
        extraction_method: 'youtube_api',
        processing_time: 1200
      },
      processingTime: 1200,
      statusCode: 200
    });

    // Populate Persona Generator (in progress)
    storeJobResult(testJobId, 'persona', {
      success: false,
      status: 'processing',
      processingTime: null,
      error: 'Analyzing collected data from all sources...'
    });

    console.log('✅ Test data populated for debug dashboard');

    return NextResponse.json({
      success: true,
      message: 'Debug test data populated successfully',
      data: {
        jobId: testJobId,
        dataSources: {
          amazon: 'Custom Amazon Scraper - 3 reviews extracted',
          reddit: 'Custom Reddit Scraper - 2 posts found', 
          website: 'Shopify API - 22 reviews extracted',
          youtube: 'YouTube API - 2 comments found',
          persona: 'Processing...'
        }
      },
      debugUrls: {
        standalone: `/debug/${testJobId}`,
        paymentSuccess: `/payment/success?debug=true&job_id=${testJobId}&free=true`
      }
    });

  } catch (error) {
    console.error('❌ Failed to populate test data:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to populate test data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}