import { NextRequest, NextResponse } from 'next/server';
import { storeJobResult, storeJobData } from '@/lib/job-cache';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    const testJobId = jobId || 'eb904fca-ee65-46af-af16-499712b2b6ea';
    
    console.log(`🧪 Populating test data for debug job: ${testJobId}`);

    // Store job cache data with competitor URLs
    storeJobData({
      jobId: testJobId,
      websiteUrl: 'https://groundluxe.com',
      amazonUrl: 'https://www.amazon.com/dp/B08N5WRWNW',
      keywords: 'grounding sheets',
      email: 'test@example.com',
      competitorUrls: [
        'https://earthing.com',
        'https://grounded.com',
        'https://betterearth.com'
      ],
      planId: 'premium',
      planName: 'Premium'
    });

    // Populate competitor results
    storeJobResult(testJobId, 'competitor_0', {
      success: true,
      websiteData: {
        customerReviews: [
          'Earthing products are life-changing!',
          'Best grounding sheets on the market'
        ],
        dataQuality: {
          method: 'shopify_scraper'
        }
      },
      analysis: {
        method: 'shopify_scraper',
        reviewsFound: 15,
        firecrawlUsed: false
      },
      processingTime: 3200,
      statusCode: 200
    });

    storeJobResult(testJobId, 'competitor_1', {
      success: true,
      websiteData: {
        customerReviews: [
          'Grounded.com sheets helped my sleep',
          'Quality is outstanding'
        ],
        dataQuality: {
          method: 'custom_scraper'
        }
      },
      analysis: {
        method: 'custom_scraper',
        reviewsFound: 8,
        firecrawlUsed: false
      },
      processingTime: 2800,
      statusCode: 200
    });

    storeJobResult(testJobId, 'competitor_2', {
      success: false,
      error: 'Failed to scrape - site requires authentication',
      processingTime: 1500,
      statusCode: 403
    });

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
      analysis: {
        method: 'custom_reddit_scraper',
        postsFound: 2,
        commentsFound: 3
      },
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
      analysis: {
        method: 'youtube_api',
        commentsFound: 2
      },
      metadata: {
        extraction_method: 'youtube_api',
        processing_time: 1200
      },
      processingTime: 1200,
      statusCode: 200
    });

    // Populate Persona Generator (completed with sample data)
    storeJobResult(testJobId, 'persona', {
      success: true,
      status: 'completed',
      processingTime: 8500,
      statusCode: 200,
      persona: {
        name: 'Sarah Wellness',
        age: 45,
        occupation: 'Yoga Instructor',
        location: 'California',
        bio: 'Health-conscious individual seeking natural wellness solutions',
        painPoints: ['Poor sleep quality', 'Chronic inflammation', 'Stress from daily life'],
        motivations: ['Natural health remedies', 'Better sleep', 'Holistic wellness'],
        buyingBehavior: 'Researches thoroughly before purchasing wellness products'
      },
      analysis: {
        method: 'gpt_analysis',
        confidence: 0.92
      }
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