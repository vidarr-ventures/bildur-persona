import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite, extractDataWithAI, generateFinalReport } from '@/lib/simple-processor';

export async function POST(request: NextRequest) {
  try {
    const { targetUrl } = await request.json();
    
    console.log('[V4 TEST] Starting simple sequential test...');
    
    // Step 1: Scrape website
    console.log('[V4 TEST] Step 1: Scraping website...');
    const scrapedContent = await scrapeWebsite(targetUrl);
    console.log(`[V4 TEST] Scraped ${scrapedContent.length} characters from ${targetUrl}`);

    // Step 2: Extract data with AI (using user's 1569-token prompt)
    console.log('[V4 TEST] Step 2: Extracting data with AI using user\'s 1569-token prompt...');
    const extractedData = await extractDataWithAI(scrapedContent);
    console.log(`[V4 TEST] Extracted ${extractedData.customer_pain_points?.length || 0} pain points and ${extractedData.raw_customer_quotes?.length || 0} quotes`);

    // Step 3: Generate final report
    console.log('[V4 TEST] Step 3: Generating final report...');
    const finalReport = await generateFinalReport([{
      url: targetUrl,
      data: extractedData,
      isUserSite: true,
    }]);
    console.log('[V4 TEST] Final report generated successfully');

    return NextResponse.json({
      success: true,
      data: {
        scrapedContentLength: scrapedContent.length,
        extractedData: {
          painPointsCount: extractedData.customer_pain_points?.length || 0,
          quotesCount: extractedData.raw_customer_quotes?.length || 0,
          demographics: extractedData.demographics,
          samplePainPoints: extractedData.customer_pain_points?.slice(0, 2),
          sampleQuotes: extractedData.raw_customer_quotes?.slice(0, 2),
        },
        finalReportPreview: finalReport.final_report.substring(0, 500) + '...',
        status: 'SUCCESS'
      },
    });

  } catch (error) {
    console.error('[V4 TEST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Test failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'V4 Simple Test API - POST with targetUrl to test sequential processing',
  });
}