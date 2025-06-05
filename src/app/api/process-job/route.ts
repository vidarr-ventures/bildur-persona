import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }
    
    console.log(`Manually processing job ${jobId}`);
    
    // Get job details first
const statusResponse = await fetch(`https://persona-sigma-ten.vercel.app/api/jobs/status/${jobId}`);
    const statusData = await statusResponse.json();
    
    if (!statusData.success) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const userInputs = statusData.job.user_inputs;
const baseUrl = 'https://persona-sigma-ten.vercel.app';    
    const results = [];
    
    // 1. Website Crawler
    try {
      console.log('Triggering website crawler...');
      const websiteResponse = await fetch(`${baseUrl}/api/workers/website-crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          payload: {
            primaryProductUrl: userInputs.primaryProductUrl,
            targetKeywords: userInputs.targetKeywords,
            userProduct: userInputs.userProduct || userInputs.targetKeywords.split(',')[0].trim(),
            businessType: userInputs.businessType,
            targetMarket: userInputs.targetMarket
          }
        }),
      });
      const websiteResult = await websiteResponse.json();
      results.push({ worker: 'website-crawler', success: websiteResponse.ok, result: websiteResult });
    } catch (error) {
      results.push({ worker: 'website-crawler', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 2. Reviews Collector (Reddit)
    try {
      console.log('Triggering reviews collector...');
      const reviewsResponse = await fetch(`${baseUrl}/api/workers/reviews-collector`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          payload: {
            targetKeywords: userInputs.targetKeywords,
            userProduct: userInputs.userProduct || userInputs.targetKeywords.split(',')[0].trim(),
            primaryProductUrl: userInputs.primaryProductUrl
          }
        }),
      });
      const reviewsResult = await reviewsResponse.json();
      results.push({ worker: 'reviews-collector', success: reviewsResponse.ok, result: reviewsResult });
    } catch (error) {
      results.push({ worker: 'reviews-collector', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
    
    // 3. Amazon Competitors (if Amazon URL provided)
    if (userInputs.amazonProductUrl) {
      try {
        console.log('Triggering amazon competitors...');
        const amazonResponse = await fetch(`${baseUrl}/api/workers/amazon-competitors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId,
            payload: {
              amazonProductUrl: userInputs.amazonProductUrl,
              targetKeywords: userInputs.targetKeywords,
              userProduct: userInputs.userProduct || userInputs.targetKeywords.split(',')[0].trim()
            }
          }),
        });
        const amazonResult = await amazonResponse.json();
        results.push({ worker: 'amazon-competitors', success: amazonResponse.ok, result: amazonResult });
      } catch (error) {
        results.push({ worker: 'amazon-competitors', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }
    
    // 4. Google Competitors
    try {
      console.log('Triggering google competitors...');
      const googleResponse = await fetch(`${baseUrl}/api/workers/google-competitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          payload: {
            primaryProductUrl: userInputs.primaryProductUrl,
            targetKeywords: userInputs.targetKeywords,
            competitors: userInputs.competitors || [],
            userProduct: userInputs.userProduct || userInputs.targetKeywords.split(',')[0].trim()
          }
        }),
      });
      const googleResult = await googleResponse.json();
      results.push({ worker: 'google-competitors', success: googleResponse.ok, result: googleResult });
    } catch (error) {
      results.push({ worker: 'google-competitors', success: false, error: error instanceof Error ? error.message : 'Unknown error' });
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

