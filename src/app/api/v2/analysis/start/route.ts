// V4 Simple Sequential API - Compatible with frontend
import { NextRequest, NextResponse } from 'next/server';
import { scrapeWebsite, extractDataWithAI, generateFinalReport } from '@/lib/simple-processor';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for demo (would use database in production)
declare global {
  var analysisStorage: Map<string, any>;
}

const getStorage = () => {
  if (!global.analysisStorage) {
    global.analysisStorage = new Map();
  }
  return global.analysisStorage;
};

export async function POST(request: NextRequest) {
  try {
    const { targetUrl, userEmail, debugMode } = await request.json();
    
    // Generate analysis ID
    const analysisId = uuidv4();
    
    console.log(`[V4] Starting analysis ${analysisId} for ${targetUrl}`);
    
    // Initialize analysis record
    const storage = getStorage();
    storage.set(analysisId, {
      id: analysisId,
      targetUrl,
      userEmail,
      debugMode,
      status: 'PROCESSING',
      startedAt: new Date().toISOString(),
      steps: [],
      result: null,
    });

    try {
      // Step 1: Scrape website
      console.log('[V4] Step 1: Scraping website...');
      const analysis = storage.get(analysisId);
      analysis.steps.push({
        name: 'scrape_website',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const scrapedContent = await scrapeWebsite(targetUrl);
      console.log(`[V4] Scraped ${scrapedContent.length} characters`);
      
      analysis.steps[0].status = 'completed';
      analysis.steps[0].completedAt = new Date().toISOString();
      analysis.steps[0].output = { contentLength: scrapedContent.length };

      // Step 2: Extract data with AI
      console.log('[V4] Step 2: Extracting data with user\'s 1569-token prompt...');
      analysis.steps.push({
        name: 'extract_data',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const extractedData = await extractDataWithAI(scrapedContent);
      console.log(`[V4] Extracted ${extractedData.customer_pain_points?.length || 0} pain points`);
      
      analysis.steps[1].status = 'completed';
      analysis.steps[1].completedAt = new Date().toISOString();
      analysis.steps[1].output = {
        painPointsCount: extractedData.customer_pain_points?.length || 0,
        quotesCount: extractedData.raw_customer_quotes?.length || 0,
      };

      // Step 3: Generate final report
      console.log('[V4] Step 3: Generating final report...');
      analysis.steps.push({
        name: 'generate_report',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const finalReport = await generateFinalReport([{
        url: targetUrl,
        data: extractedData,
        isUserSite: true,
      }]);
      
      analysis.steps[2].status = 'completed';
      analysis.steps[2].completedAt = new Date().toISOString();
      analysis.steps[2].output = { reportGenerated: true };

      // Complete analysis
      analysis.status = 'COMPLETED';
      analysis.completedAt = new Date().toISOString();
      analysis.result = {
        extractedData,
        finalReport: finalReport.final_report,
        summary: finalReport.final_report.substring(0, 500) + '...',
      };
      
      storage.set(analysisId, analysis);
      console.log(`[V4] Analysis ${analysisId} completed successfully`);

      return NextResponse.json({
        success: true,
        data: {
          analysisId,
          status: 'COMPLETED',
        },
      });

    } catch (processingError) {
      console.error('[V4] Processing error:', processingError);
      
      const analysis = storage.get(analysisId);
      analysis.status = 'FAILED';
      analysis.completedAt = new Date().toISOString();
      analysis.error = processingError instanceof Error ? processingError.message : 'Processing failed';
      storage.set(analysisId, analysis);

      throw processingError;
    }

  } catch (error) {
    console.error('[V4] API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Analysis failed',
        },
      },
      { status: 500 }
    );
  }
}