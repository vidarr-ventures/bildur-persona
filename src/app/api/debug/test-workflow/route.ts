// Add this temporary debug endpoint to test the workflow
// Create: src/app/api/debug/test-workflow/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
    }

    console.log(`=== DEBUG: Testing workflow for job ${jobId} ===`);
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    // Test website crawler
    console.log('Testing website crawler...');
    try {
      const websiteResponse = await fetch(`${baseUrl}/api/workers/website-crawler`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          websiteUrl: 'https://groundluxe.com',
          targetKeywords: 'grounding sheets'
        })
      });
      
      console.log(`Website crawler status: ${websiteResponse.status}`);
      const websiteData = await websiteResponse.text();
      console.log(`Website crawler response: ${websiteData.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('Website crawler failed:', error);
    }

    // Test Amazon reviews worker
    console.log('Testing Amazon reviews worker...');
    try {
      const amazonResponse = await fetch(`${baseUrl}/api/workers/amazon-reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          amazonUrl: 'https://www.amazon.com/GroundLuxe-Organic-Fitted-Earthing-Grounding/dp/B07RLNS58H',
          targetKeywords: 'grounding sheets'
        })
      });
      
      console.log(`Amazon worker status: ${amazonResponse.status}`);
      const amazonData = await amazonResponse.text();
      console.log(`Amazon worker response: ${amazonData.substring(0, 200)}...`);
      
    } catch (error) {
      console.error('Amazon worker failed:', error);
    }

    // Check environment variables
    console.log('Environment check:');
    console.log(`SCRAPEOWL_API_KEY present: ${!!process.env.SCRAPEOWL_API_KEY}`);
    console.log(`NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL}`);

    return NextResponse.json({
      success: true,
      message: 'Debug test completed - check server logs',
      jobId
    });

  } catch (error) {
    console.error('Debug test error:', error);
    return NextResponse.json(
      { error: 'Debug test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
