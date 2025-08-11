import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsiteWithFirecrawl } from '@/lib/firecrawl-processor';
import { extractDataWithAI, generateFinalReport } from '@/lib/simple-processor';

export async function POST(request: NextRequest) {
  console.log('[FIRECRAWL TEST] API endpoint called');
  
  try {
    const body = await request.json();
    console.log('[FIRECRAWL TEST] Request body:', body);
    const { targetUrl, keywords = [] } = body;
    
    if (!targetUrl) {
      console.log('[FIRECRAWL TEST] No targetUrl provided');
      return NextResponse.json(
        { success: false, error: { message: 'targetUrl is required' } },
        { status: 400 }
      );
    }

    // Check if Firecrawl API key is available
    if (!process.env.FIRECRAWL_API_KEY) {
      console.log('[FIRECRAWL TEST] Firecrawl API key not found');
      return NextResponse.json(
        { 
          success: false, 
          error: { message: 'Firecrawl API key not configured' } 
        },
        { status: 500 }
      );
    }

    console.log('[FIRECRAWL TEST] Starting enhanced web scraping...');
    console.log(`[FIRECRAWL TEST] URL: ${targetUrl}`);
    console.log(`[FIRECRAWL TEST] Keywords: ${keywords.join(', ')}`);

    // Step 1: Enhanced web scraping with Firecrawl
    console.log('[FIRECRAWL TEST] Step 1: Enhanced web scraping with Firecrawl...');
    const scrapeResult = await scrapeWebsiteWithFirecrawl(targetUrl, keywords);
    console.log(`[FIRECRAWL TEST] Scraped ${scrapeResult.content.length} characters from ${scrapeResult.metadata.totalPages} pages`);
    console.log(`[FIRECRAWL TEST] Scraping method: ${scrapeResult.metadata.scrapingMethod}`);

    // Step 2: Extract data with AI
    console.log('[FIRECRAWL TEST] Step 2: Extracting data with AI...');
    const extractedData = await extractDataWithAI(scrapeResult.content, keywords);
    console.log(`[FIRECRAWL TEST] Extracted ${extractedData.customer_pain_points?.length || 0} pain points and ${extractedData.raw_customer_quotes?.length || 0} quotes`);

    // Step 3: Generate final report
    console.log('[FIRECRAWL TEST] Step 3: Generating final report...');
    const finalReport = await generateFinalReport([{
      url: targetUrl,
      data: extractedData,
      isUserSite: true,
    }]);
    console.log('[FIRECRAWL TEST] Final report generated successfully');

    return NextResponse.json({
      success: true,
      data: {
        scrapingResults: {
          contentLength: scrapeResult.content.length,
          pagesProcessed: scrapeResult.metadata.totalPages,
          relevantPages: scrapeResult.metadata.relevantPages,
          scrapingMethod: scrapeResult.metadata.scrapingMethod,
          creditsUsed: scrapeResult.metadata.creditsUsed
        },
        extractedData: {
          painPointsCount: extractedData.customer_pain_points?.length || 0,
          quotesCount: extractedData.raw_customer_quotes?.length || 0,
          demographics: extractedData.demographics,
          faqCount: extractedData.faq_count || 0,
          reviewsFound: extractedData.reviews_found || 0,
          samplePainPoints: extractedData.customer_pain_points?.slice(0, 3),
          sampleQuotes: extractedData.raw_customer_quotes?.slice(0, 3),
          valuePropositions: extractedData.value_propositions?.slice(0, 2)
        },
        finalReport: finalReport.final_report,
        finalReportPreview: finalReport.final_report.substring(0, 500) + '...',
        status: 'SUCCESS'
      },
      message: "Enhanced scraping with Firecrawl completed successfully"
    });

  } catch (error) {
    console.error('[FIRECRAWL TEST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Firecrawl test failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Firecrawl Enhanced Scraping API - POST with targetUrl and optional keywords',
    example: {
      targetUrl: 'https://example.com',
      keywords: ['customer service', 'pricing issues']
    },
    note: 'This endpoint uses Firecrawl API for enhanced web scraping with intelligent page discovery'
  });
}