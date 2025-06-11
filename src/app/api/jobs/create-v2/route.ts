import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, saveJobData, completeJob } from '@/lib/db';

// Import the Amazon extraction function directly
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
              wait_for: 3000,
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
              const ratingMatch = review.rating?.match(/a-star-(\d)/);
              const rating = ratingMatch ? parseInt(ratingMatch[1]) : 3;
              
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
            
            // Add delay between requests
            if (page < maxPagesToScrape) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
            
          } else {
            console.log(`Page ${page} failed with status ${scrapeResponse.status}`);
            if (page === 1) break;
          }
          
        } catch (pageError) {
          console.error(`Error scraping page ${page}:`, pageError);
        }
      }
      
      console.log(`ScrapeOwl multi-page extraction completed: ${allReviews.length} total reviews`);
    } else {
      console.log('No SCRAPEOWL_API_KEY found in environment');
    }
    
    return {
      reviews: allReviews,
      productInfo: productInfo,
      extractionMethod: allReviews.length > 0 ? 'multi_page_scrapeowl' : 'extraction_failed',
      realReviewsCount: allReviews.length
    };
    
  } catch (error) {
    console.error('Error in multi-page Amazon extraction:', error);
    return {
      reviews: [],
      productInfo: {},
      extractionMethod: 'extraction_failed',
      realReviewsCount: 0
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const websiteUrl = body.primaryProductUrl;
    const amazonUrl = body.amazonProductUrl;
    const targetKeywords = body.targetKeywords;

    console.log('Creating job with data:', { websiteUrl, targetKeywords, amazonUrl });

    // Create job in database
    const job = await createJob({
      website_url: websiteUrl,
      target_keywords: targetKeywords,
      amazon_url: amazonUrl || null,
      status: 'pending'
    });

    console.log('Job created successfully:', job.id);

    // Process inline and wait for completion
    await processJobInline(job.id, websiteUrl, targetKeywords, amazonUrl);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Analysis completed successfully'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json({ error: 'Failed to create analysis job' }, { status: 500 });
  }
}

async function processJobInline(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`=== Starting inline job processing for ${jobId} ===`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Website crawling inline
    console.log('Starting website crawling...');
    const websiteData = await crawlWebsite(websiteUrl);
    await saveJobData(jobId, 'website', {
      websiteData,
      metadata: { timestamp: new Date().toISOString(), websiteUrl, targetKeywords }
    });
    console.log('Website crawling completed');

    // Amazon reviews extraction using direct function call
    if (amazonUrl) {
      console.log('Starting Amazon reviews extraction...');
      const amazonResult = await extractMultiPageAmazonReviews(amazonUrl, targetKeywords);
      
      await saveJobData(jobId, 'amazon_reviews', {
        reviews: amazonResult.reviews,
        productInfo: amazonResult.productInfo,
        metadata: { 
          timestamp: new Date().toISOString(), 
          amazonUrl, 
          targetKeywords,
          extractionMethod: amazonResult.extractionMethod,
          realReviewsCount: amazonResult.realReviewsCount
        }
      });
      
      console.log(`Amazon reviews extraction completed: ${amazonResult.realReviewsCount} reviews`);
    }

    // Persona generation inline
    console.log('Starting persona generation...');
    const personaData = await generatePersona(jobId, websiteUrl, targetKeywords, amazonUrl);
    
    // Complete the job
    await completeJob(jobId);
    console.log(`Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
    throw error;
  }
}

async function crawlWebsite(websiteUrl: string) {
  try {
    console.log(`Crawling website: ${websiteUrl}`);
    
    const response = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Successfully fetched ${html.length} characters from ${websiteUrl}`);
    
    // Extract main content
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Extracted ${content.length} characters of clean content`);
    
    return {
      homePageContent: content.substring(0, 2000),
      brandMessaging: 'Extracted brand messaging',
      features: ['Feature 1', 'Feature 2'],
      valuePropositions: ['Value prop 1', 'Value prop 2']
    };

  } catch (error) {
    console.error('Website crawling error:', error);
    throw error;
  }
}

async function generatePersona(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`Generating persona for job ${jobId}`);
    
    // Mock persona generation for now
    const mockPersona = {
      primaryPersona: {
        name: "Sarah Thompson",
        age: "35-45",
        title: "Health-Conscious Professional",
        painPoints: ["Sleep issues", "Stress management", "Natural wellness"],
        goals: ["Better sleep quality", "Reduced inflammation", "Natural health solutions"],
        characteristics: ["Research-oriented", "Values quality", "Wellness-focused"]
      }
    };

    await saveJobData(jobId, 'persona', {
      persona: mockPersona,
      metadata: { timestamp: new Date().toISOString(), method: 'mock_generation' }
    });

    console.log(`Persona generation completed for job ${jobId}`);
    return mockPersona;

  } catch (error) {
    console.error('Persona generation error:', error);
    throw error;
  }
}