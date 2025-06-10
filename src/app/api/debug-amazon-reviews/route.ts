import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const testAmazonUrl = 'https://www.amazon.com/GroundLuxe-Organic-Fitted-Earthing-Grounding/dp/B07RLNS58H';
    
    console.log('Testing Amazon reviews extraction...');
    
    // Extract ASIN from Amazon URL
    const asinMatch = testAmazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     testAmazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     testAmazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      return NextResponse.json({
        error: 'Could not extract ASIN from Amazon URL',
        url: testAmazonUrl
      });
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    // Test ScrapeOwl with Amazon reviews page
    const reviewsUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?reviewerType=all_reviews&sortBy=recent&pageNumber=1`;
    
    const results = {
      amazonUrl: testAmazonUrl,
      asin: asin,
      reviewsUrl: reviewsUrl,
      scrapeOwlAvailable: !!process.env.SCRAPEOWL_API_KEY,
      scrapeOwlResult: null as any,
      fallbackResults: null as any
    };
    
    // Test ScrapeOwl if available
    if (process.env.SCRAPEOWL_API_KEY) {
      try {
        console.log('Testing ScrapeOwl with reviews URL...');
        
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
                  { name: 'reviewer', selector: '.a-profile-name' }
                ]
              },
              { name: 'page_title', selector: 'title' },
              { name: 'review_count', selector: '[data-hook="total-review-count"]' },
              { name: 'average_rating', selector: '[data-hook="rating-out-of-text"]' }
            ],
          }),
        });

        if (scrapeResponse.ok) {
          const data = await scrapeResponse.json();
          results.scrapeOwlResult = {
            success: true,
            reviewsFound: data.reviews?.length || 0,
            pageTitle: data.page_title,
            reviewCount: data.review_count,
            averageRating: data.average_rating,
            sampleReviews: (data.reviews || []).slice(0, 3).map((review: any) => ({
              title: review.title,
              rating: review.rating,
              text: review.text?.substring(0, 200),
              verified: !!review.verified
            })),
            rawDataSample: {
              totalElements: Object.keys(data).length,
              elementTypes: Object.keys(data)
            }
          };
        } else {
          const errorText = await scrapeResponse.text();
          results.scrapeOwlResult = {
            success: false,
            error: `HTTP ${scrapeResponse.status}`,
            details: errorText.substring(0, 500)
          };
        }
      } catch (scrapeError) {
        results.scrapeOwlResult = {
          success: false,
          error: 'Exception occurred',
          details: scrapeError instanceof Error ? scrapeError.message : 'Unknown error'
        };
      }
    }
    
    // Test fallback: Search Reddit for Amazon reviews
    try {
      console.log('Testing Reddit fallback...');
      
      const redditSearchUrl = `https://www.reddit.com/search.json?q="${asin}" Amazon review&sort=relevance&limit=10`;
      
      const redditResponse = await fetch(redditSearchUrl, {
        headers: {
          'User-Agent': 'ReviewBot/1.0 (by /u/researcher)'
        }
      });

      if (redditResponse.ok) {
        const redditData = await redditResponse.json();
        
        results.fallbackResults = {
          success: true,
          redditPostsFound: redditData.data?.children?.length || 0,
          samplePosts: (redditData.data?.children || []).slice(0, 3).map((post: any) => ({
            title: post.data.title,
            subreddit: post.data.subreddit,
            text: post.data.selftext?.substring(0, 200),
            score: post.data.score
          }))
        };
      } else {
        results.fallbackResults = {
          success: false,
          error: `Reddit API error: ${redditResponse.status}`
        };
      }
    } catch (redditError) {
      results.fallbackResults = {
        success: false,
        error: 'Reddit search failed',
        details: redditError instanceof Error ? redditError.message : 'Unknown error'
      };
    }
    
    return NextResponse.json({
      success: true,
      message: 'Amazon reviews debug completed',
      results: results,
      recommendations: {
        scrapeOwlWorking: results.scrapeOwlResult?.success && results.scrapeOwlResult?.reviewsFound > 0,
        fallbackWorking: results.fallbackResults?.success,
        nextSteps: results.scrapeOwlResult?.success ? 
          'ScrapeOwl is working - check worker timeout settings' : 
          'ScrapeOwl failed - relying on Reddit fallback'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Amazon reviews debug failed',
      details: errorMessage
    }, { status: 500 });
  }
}
