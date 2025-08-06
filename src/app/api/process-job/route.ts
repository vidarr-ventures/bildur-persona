import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json({ error: 'jobId required' }, { status: 400 });
    }
    
    console.log(`Manual processing requested for job ${jobId} - worker system has been removed`);
    
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

    // Worker system has been removed - return appropriate message
    const results = [
      { worker: 'website-crawler', success: false, error: 'Worker system has been removed' },
      { worker: 'reddit-scraper', success: false, error: 'Worker system has been removed' },
      { worker: 'amazon-reviews', success: false, error: 'Worker system has been removed' },
      { worker: 'youtube-comments', success: false, error: 'Worker system has been removed' },
      { worker: 'persona-generator', success: false, error: 'Worker system has been removed' }
    ];
    
    return NextResponse.json({
      success: false,
      message: 'Worker system has been removed - direct processing will be implemented',
      jobId,
      results,
      completedWorkers: 0,
      totalWorkers: results.length,
      note: 'All workers have been disabled as part of system simplification'
    });
    
  } catch (error) {
    console.error('Manual job processing error:', error);
    return NextResponse.json({
      error: 'Job processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

