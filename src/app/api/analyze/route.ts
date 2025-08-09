import { NextRequest, NextResponse } from 'next/server';
import { createAnalysis, updateAnalysis } from '../../../lib/database';
import { scrapeWebsite, extractDataWithAI, generateFinalReport } from '../../../lib/simple-processor';

export async function POST(request: NextRequest) {
  try {
    const { url, competitors = [], email, debug = false } = await request.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    if (!Array.isArray(competitors) || competitors.length === 0) {
      return NextResponse.json({ error: 'At least one competitor URL is required' }, { status: 400 });
    }
    
    // Validate URLs
    try {
      new URL(url);
      competitors.forEach((competitorUrl: string) => new URL(competitorUrl));
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }
    
    // Create analysis record
    const analysisId = await createAnalysis(url, email);
    const allUrls = [url, ...competitors];
    const extractedData: any[] = [];
    
    try {
      // Simple loop: scrape → extract → store for each URL
      for (const currentUrl of allUrls) {
        console.log(`Processing: ${currentUrl}`);
        
        // 1. Scrape website content
        const scrapeResult = await scrapeWebsite(currentUrl, []);
        
        // 2. Extract data using your prompt
        const data = await extractDataWithAI(scrapeResult.content, []);
        
        // 3. Store extracted data
        extractedData.push({
          url: currentUrl,
          data: data,
          isUserSite: currentUrl === url
        });
      }
      
      // After all URLs processed: generate final report
      const finalReport = await generateFinalReport(extractedData);
      
      // Save completed analysis
      await updateAnalysis(analysisId, 'completed', finalReport, debug ? { urls_processed: allUrls.length } : undefined);
      
      return NextResponse.json({
        success: true,
        analysisId,
        status: 'completed',
        data: finalReport
      });
      
    } catch (processingError) {
      console.error(`Processing failed:`, processingError);
      const errorMessage = processingError instanceof Error ? processingError.message : 'Processing failed';
      
      await updateAnalysis(analysisId, 'failed', null, { error: errorMessage });
      
      return NextResponse.json({
        success: false,
        analysisId,
        status: 'failed',
        error: errorMessage
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('Request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}