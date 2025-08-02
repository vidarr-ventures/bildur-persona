import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('=== TEST AMAZON ENDPOINT ===');
    console.log('Full request body:', JSON.stringify(body, null, 2));
    console.log('Amazon URL from body:', body.amazonUrl);
    console.log('Amazon URL type:', typeof body.amazonUrl);
    console.log('===========================');
    
    return NextResponse.json({
      received: body,
      amazonUrl: body.amazonUrl,
      amazonUrlExists: !!body.amazonUrl,
      message: `Received Amazon URL: ${body.amazonUrl || 'NONE'}`
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to parse request',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Test endpoint for debugging Amazon URL passing',
    usage: 'POST with your form data to see what gets received'
  });
}