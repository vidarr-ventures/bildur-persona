import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing ScrapeOwl with API key:', process.env.SCRAPEOWL_API_KEY ? 'Present' : 'Missing');
    
    const response = await fetch('https://api.scrapeowl.com/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.SCRAPEOWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.SCRAPEOWL_API_KEY,
        url: 'https://example.com',
        elements: [
          { name: 'title', selector: 'title' },
          { name: 'h1', selector: 'h1', multiple: true },
          { name: 'paragraphs', selector: 'p', multiple: true },
        ],
      }),
    });

    console.log('ScrapeOwl response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: 'ScrapeOwl API failed',
        status: response.status,
        details: errorText,
        hasApiKey: !!process.env.SCRAPEOWL_API_KEY
      });
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      hasApiKey: !!process.env.SCRAPEOWL_API_KEY,
      scrapeOwlResponse: data,
      extractedContent: {
        title: data.title,
        h1Count: data.h1?.length || 0,
        paragraphCount: data.paragraphs?.length || 0,
        sampleParagraph: data.paragraphs?.[0] || 'No paragraphs found'
      }
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({
      error: 'Debug scrape failed',
      details: errorMessage,
      hasApiKey: !!process.env.SCRAPEOWL_API_KEY
    }, { status: 500 });
  }
}
