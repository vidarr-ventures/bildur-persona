import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    console.log('=== SIMPLE AMAZON TEST ===');
    console.log('Full request body:', JSON.stringify(requestBody, null, 2));
    
    const { jobId, amazonUrl, targetKeywords } = requestBody;
    
    if (!amazonUrl || amazonUrl.trim() === '') {
      return NextResponse.json({ 
        success: false,
        message: 'No Amazon URL provided',
        debugInfo: {
          receivedAmazonUrl: amazonUrl,
          amazonUrlType: typeof amazonUrl,
          amazonUrlLength: amazonUrl?.length,
          jobId: jobId
        }
      });
    }
    
    // Just return success without doing any database operations
    return NextResponse.json({
      success: true,
      message: `Would process Amazon URL: ${amazonUrl}`,
      data: {
        jobId,
        amazonUrl,
        targetKeywords,
        status: 'ready_to_process'
      }
    });
    
  } catch (error) {
    console.error('Simple Amazon test error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}