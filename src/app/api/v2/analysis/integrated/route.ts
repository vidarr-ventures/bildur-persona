// Integrated Analysis API - Combines all data sources (Website, YouTube, Reddit, Competitors)
import { NextRequest, NextResponse } from 'next/server';
import { integrateAllDataSources, generateIntegratedPersona } from '@/lib/integrated-processor';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage for demo
declare global {
  var integratedAnalysisStorage: Map<string, any>;
}

const getStorage = () => {
  if (!global.integratedAnalysisStorage) {
    global.integratedAnalysisStorage = new Map();
  }
  return global.integratedAnalysisStorage;
};

export async function POST(request: NextRequest) {
  try {
    const { 
      targetUrl, 
      competitorUrls = [], 
      keywordPhrases = [], 
      userEmail, 
      debugMode,
      enableYouTube = true,
      enableReddit = true 
    } = await request.json();
    
    // Generate analysis ID
    const analysisId = uuidv4();
    
    console.log(`[Integrated] Starting analysis ${analysisId} for ${targetUrl}`);
    console.log(`[Integrated] Data sources enabled: Website, ${enableYouTube ? 'YouTube,' : ''} ${enableReddit ? 'Reddit,' : ''} ${competitorUrls.length} competitors`);
    
    // Initialize analysis record
    const storage = getStorage();
    storage.set(analysisId, {
      id: analysisId,
      targetUrl,
      competitorUrls,
      keywordPhrases,
      userEmail,
      debugMode,
      enableYouTube,
      enableReddit,
      status: 'PROCESSING',
      startedAt: new Date().toISOString(),
      steps: [],
      result: null,
    });

    try {
      const analysis = storage.get(analysisId);
      
      // Step 1: Collect data from all sources
      console.log('[Integrated] Step 1: Collecting data from all sources...');
      analysis.steps.push({
        name: 'collect_all_data',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const integratedData = await integrateAllDataSources(
        targetUrl,
        competitorUrls,
        keywordPhrases
      );
      
      console.log(`[Integrated] Collected data from ${integratedData.dataSources.length} sources:`);
      console.log(`  - Website quotes: ${integratedData.websiteData.raw_customer_quotes?.length || 0}`);
      console.log(`  - YouTube comments: ${integratedData.youtubeData?.total_comments || 0}`);
      console.log(`  - Reddit posts: ${integratedData.redditData?.total_items || 0}`);
      console.log(`  - Competitor sites: ${integratedData.competitorData.length}`);
      console.log(`  - Total data points: ${integratedData.totalReviewCount}`);
      
      analysis.steps[0].status = 'completed';
      analysis.steps[0].completedAt = new Date().toISOString();
      analysis.steps[0].output = {
        dataSources: integratedData.dataSources,
        totalReviewCount: integratedData.totalReviewCount,
        youtubeComments: integratedData.youtubeData?.total_comments || 0,
        redditPosts: integratedData.redditData?.total_items || 0,
        competitorSites: integratedData.competitorData.length,
        dataQualityMet: integratedData.totalReviewCount >= 20
      };

      // Step 2: Generate integrated persona
      console.log('[Integrated] Step 2: Generating integrated persona from all data sources...');
      analysis.steps.push({
        name: 'generate_persona',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      
      const personaResult = await generateIntegratedPersona(integratedData);
      
      analysis.steps[1].status = 'completed';
      analysis.steps[1].completedAt = new Date().toISOString();
      analysis.steps[1].output = {
        personaGenerated: true,
        metadata: personaResult.metadata
      };

      // Complete analysis
      analysis.status = 'COMPLETED';
      analysis.completedAt = new Date().toISOString();
      analysis.result = {
        persona: personaResult.persona,
        metadata: personaResult.metadata,
        integratedData: debugMode ? integratedData : undefined
      };

      console.log(`[Integrated] Analysis ${analysisId} completed successfully`);

      return NextResponse.json({
        success: true,
        analysisId,
        message: 'Integrated analysis started successfully',
        dataSources: integratedData.dataSources,
        totalDataPoints: integratedData.totalReviewCount
      });

    } catch (error) {
      const analysis = storage.get(analysisId);
      analysis.status = 'FAILED';
      analysis.error = error instanceof Error ? error.message : 'Unknown error';
      analysis.completedAt = new Date().toISOString();
      
      throw error;
    }

  } catch (error) {
    console.error('[Integrated] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve analysis results
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const analysisId = searchParams.get('id');
  
  if (!analysisId) {
    return NextResponse.json(
      { success: false, error: 'Analysis ID required' },
      { status: 400 }
    );
  }
  
  const storage = getStorage();
  const analysis = storage.get(analysisId);
  
  if (!analysis) {
    return NextResponse.json(
      { success: false, error: 'Analysis not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json({
    success: true,
    analysis
  });
}