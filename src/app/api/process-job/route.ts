import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }
    
    console.log(`Manually processing job ${jobId}`);
    
    // Get job details first - check multiple possible endpoints
    let userInputs;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://persona.bildur.ai';
    
    try {
      // Try the debug endpoint first
      const debugResponse = await fetch(`${baseUrl}/api/debug/job/${jobId}`);
      const debugData = await debugResponse.json();
      
      if (debugData.jobId) {
        // Create mock user inputs based on the test job structure
        userInputs = {
          primaryProductUrl: 'https://example.com',
          targetKeywords: 'test product, quality items',
          amazonProductUrl: 'https://www.amazon.com/dp/B08N5WRWNW',
          userProduct: 'test product',
          businessType: 'ecommerce',
          targetMarket: 'general consumers',
          competitors: []
        };
        console.log('Using mock user inputs for test job:', userInputs);
      } else {
        return NextResponse.json({ error: 'Job not found or invalid' }, { status: 404 });
      }
    } catch (error) {
      console.error('Error fetching job details:', error);
      return NextResponse.json({ error: 'Failed to fetch job details' }, { status: 500 });
    }    
    const results = [];
    
    // 1. Website Crawler
    try {
      console.log('Triggering website crawler...');
      const websiteResponse = await fetch(`${baseUrl}/api/workers/website-crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          websiteUrl: userInputs.primaryProductUrl,
          targetKeywords: userInputs.targetKeywords,
          competitorUrls: userInputs.competitors || []
        }),
      });
      const websiteResult = await websiteResponse.json();
      results.push({ worker: 'website-crawler', success: websiteResponse.ok, result: websiteResult });
    } catch (error) {
      results.push({ worker: 'website-crawler', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 2. Reddit Scraper
    try {
      console.log('Triggering reddit scraper...');
      const redditResponse = await fetch(`${baseUrl}/api/workers/reddit-scraper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          targetKeywords: userInputs.targetKeywords
        }),
      });
      const redditResult = await redditResponse.json();
      results.push({ worker: 'reddit-scraper', success: redditResponse.ok, result: redditResult });
    } catch (error) {
      results.push({ worker: 'reddit-scraper', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 3. Amazon Reviews (if Amazon URL provided)
    if (userInputs.amazonProductUrl) {
      try {
        console.log('Triggering amazon reviews...');
        const amazonResponse = await fetch(`${baseUrl}/api/workers/amazon-reviews`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            amazonUrl: userInputs.amazonProductUrl,
            targetKeywords: userInputs.targetKeywords,
            planName: 'Essential'
          }),
        });
        const amazonResult = await amazonResponse.json();
        results.push({ worker: 'amazon-reviews', success: amazonResponse.ok, result: amazonResult });
      } catch (error) {
        results.push({ worker: 'amazon-reviews', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    // 4. YouTube Comments
    try {
      console.log('Triggering youtube comments...');
      const youtubeResponse = await fetch(`${baseUrl}/api/workers/youtube-comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          keywords: userInputs.targetKeywords
        }),
      });
      const youtubeResult = await youtubeResponse.json();
      results.push({ worker: 'youtube-comments', success: youtubeResponse.ok, result: youtubeResult });
    } catch (error) {
      results.push({ worker: 'youtube-comments', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 5. Persona Generator (final step)
    try {
      console.log('Triggering persona generator...');
      const personaResponse = await fetch(`${baseUrl}/api/workers/persona-generator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          payload: {
            targetKeywords: userInputs.targetKeywords,
            userProduct: userInputs.userProduct || userInputs.targetKeywords.split(',')[0].trim(),
            rawReviews: [], // Would be populated by actual data collection
            competitors: [],
            websiteData: [],
            websiteInsights: {},
            redditData: [],
            redditInsights: {}
          }
        }),
      });
      const personaResult = await personaResponse.json();
      results.push({ worker: 'persona-generator', success: personaResponse.ok, result: personaResult });
    } catch (error) {
      results.push({ worker: 'persona-generator', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    return NextResponse.json({
      success: true,
      message: 'Job processing completed',
      jobId,
      results,
      completedWorkers: results.filter(r => r.success).length,
      totalWorkers: results.length
    });
    
  } catch (error) {
    console.error('Manual job processing error:', error);
    return NextResponse.json({
      error: 'Job processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

