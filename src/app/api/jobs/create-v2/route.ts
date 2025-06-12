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
    
    // Try ScrapeOwl with simple debug selector
    if (process.env.SCRAPEOWL_API_KEY) {
      console.log('Attempting ScrapeOwl extraction with debug selectors...');
      
      try {
        console.log(`Scraping Amazon reviews page 1 for debug...`);
        
        const reviewUrl = `https://www.amazon.com/product-reviews/${asin}/ref=cm_cr_dp_d_show_all_btm?reviewerType=all_reviews&sortBy=recent&pageNumber=1`;
        
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
                name: 'page_content', 
                selector: 'body'
              }
            ]
          }),
        });

        if (scrapeResponse.ok) {
          const data = await scrapeResponse.json();
          console.log(`Debug: ScrapeOwl response keys:`, Object.keys(data));
          console.log(`Debug: Page content length:`, data.page_content?.length || 0);
          console.log(`Debug: First 500 chars:`, data.page_content?.substring(0, 500) || 'No content');
        } else {
          console.log(`Debug: ScrapeOwl failed with status ${scrapeResponse.status}`);
        }
        
      } catch (pageError) {
        console.error(`Debug: Error scraping:`, pageError);
      }
      
      console.log(`Debug extraction completed`);
    } else {
      console.log('No SCRAPEOWL_API_KEY found in environment');
    }
    
    return {
      reviews: allReviews,
      productInfo: productInfo,
      extractionMethod: 'debug_mode',
      realReviewsCount: allReviews.length
    };
    
  } catch (error) {
    console.error('Error in Amazon extraction:', error);
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