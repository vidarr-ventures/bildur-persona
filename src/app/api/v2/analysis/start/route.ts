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
    const { targetUrl, competitorUrls = [], keywordPhrases = [], userEmail, debugMode } = await request.json();
    
    // Generate analysis ID
    const analysisId = uuidv4();
    
    console.log(`[V4] Starting analysis ${analysisId} for ${targetUrl}`);
    
    // Initialize analysis record
    const storage = getStorage();
    storage.set(analysisId, {
      id: analysisId,
      targetUrl,
      competitorUrls,
      keywordPhrases,
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
      
      const scrapeResult = await scrapeWebsite(targetUrl, keywordPhrases);
      console.log(`[V4] Scraped ${scrapeResult.content.length} characters from ${scrapeResult.metadata.totalPages} pages`);
      
      analysis.steps[0].status = 'completed';
      analysis.steps[0].completedAt = new Date().toISOString();
      analysis.steps[0].output = { 
        contentLength: scrapeResult.content.length,
        totalPages: scrapeResult.metadata.totalPages,
        blogPages: scrapeResult.metadata.blogPages,
        faqPages: scrapeResult.metadata.faqPages,
        reviewPages: scrapeResult.metadata.reviewPages,
      };

      // Step 2: Extract data with AI
      console.log('[V4] Step 2: Extracting data with user\'s 1569-token prompt...');
      analysis.steps.push({
        name: 'extract_data',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const extractedData = await extractDataWithAI(scrapeResult.content, keywordPhrases);
      console.log(`[V4] Extracted ${extractedData.customer_pain_points?.length || 0} pain points and ${extractedData.raw_customer_quotes?.length || 0} quotes`);
      
      analysis.steps[1].status = 'completed';
      analysis.steps[1].completedAt = new Date().toISOString();
      analysis.steps[1].output = {
        painPointsCount: extractedData.customer_pain_points?.length || 0,
        quotesCount: extractedData.raw_customer_quotes?.length || 0,
        faqCount: extractedData.faq_count || 0,
        reviewsFound: extractedData.reviews_found || 0,
      };

      // Step 3: Process competitor URLs if provided
      const allSiteData = [{
        url: targetUrl,
        data: extractedData,
        isUserSite: true,
      }];

      if (competitorUrls && competitorUrls.length > 0) {
        console.log(`[V4] Step 3: Processing ${competitorUrls.length} competitor URLs in parallel...`);
        
        // Add step tracking for all competitors
        const competitorStepIndexes: number[] = [];
        for (let i = 0; i < competitorUrls.length; i++) {
          analysis.steps.push({
            name: `scrape_competitor_${i + 1}`,
            status: 'in_progress',
            startedAt: new Date().toISOString(),
          });
          competitorStepIndexes.push(analysis.steps.length - 1);
        }
        
        // Process all competitors in parallel
        const competitorPromises = competitorUrls.map(async (compUrl: string, index: number) => {
          const stepIndex = competitorStepIndexes[index];
          
          try {
            console.log(`[V4] Scraping competitor: ${compUrl}`);
            const compScrapeResult = await scrapeWebsite(compUrl, keywordPhrases);
            const compData = await extractDataWithAI(compScrapeResult.content, keywordPhrases);
            
            analysis.steps[stepIndex].status = 'completed';
            analysis.steps[stepIndex].completedAt = new Date().toISOString();
            analysis.steps[stepIndex].output = {
              contentLength: compScrapeResult.content.length,
              totalPages: compScrapeResult.metadata.totalPages,
              blogPages: compScrapeResult.metadata.blogPages,
              faqPages: compScrapeResult.metadata.faqPages,
              reviewPages: compScrapeResult.metadata.reviewPages,
              painPointsCount: compData.customer_pain_points?.length || 0,
              quotesCount: compData.raw_customer_quotes?.length || 0,
              faqCount: compData.faq_count || 0,
              reviewsFound: compData.reviews_found || 0,
            };
            
            return {
              url: compUrl,
              data: compData,
              isUserSite: false,
            };
          } catch (error) {
            console.error(`[V4] Failed to process competitor ${compUrl}:`, error);
            analysis.steps[stepIndex].status = 'failed';
            analysis.steps[stepIndex].completedAt = new Date().toISOString();
            return null;
          }
        });
        
        // Wait for all competitors to complete
        const competitorResults = await Promise.all(competitorPromises);
        
        // Add successful results to allSiteData
        competitorResults.forEach(result => {
          if (result) {
            allSiteData.push(result);
          }
        });
      }

      // Step 4: Generate final report with all data
      console.log('[V4] Step 4: Generating final report with all data...');
      analysis.steps.push({
        name: 'generate_report',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const finalReport = await generateFinalReport(allSiteData);
      
      analysis.steps[analysis.steps.length - 1].status = 'completed';
      analysis.steps[analysis.steps.length - 1].completedAt = new Date().toISOString();
      analysis.steps[analysis.steps.length - 1].output = { reportGenerated: true };

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
          results: {
            id: 'report-' + analysisId,
            analysisId,
            fullReport: finalReport.final_report,
            summary: finalReport.final_report.substring(0, 500) + '...',
            demographics: extractedData?.demographics || {},
            painPoints: extractedData?.customer_pain_points || [],
            quotes: extractedData?.raw_customer_quotes || [],
            valuePropositions: extractedData?.value_propositions || [],
            behaviorPatterns: extractedData?.behavioral_patterns || [],
            generatedAt: new Date().toISOString(),
          },
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