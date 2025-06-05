import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }
    
    console.log(`Testing worker trigger for job ${jobId}`);
    
    // Try to trigger the website crawler directly
    const websiteCrawlerResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/workers/website-crawler`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobId,
        payload: {
          primaryProductUrl: 'https://example.com',
          targetKeywords: 'test keywords',
          userProduct: 'test product'
        }
      }),
    });
    
    const result = await websiteCrawlerResponse.text();
    
    return NextResponse.json({
      success: true,
      message: 'Worker triggered',
      result,
      status: websiteCrawlerResponse.status
    });
    
  } catch (error) {
    console.error('Test worker error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
