import { NextRequest, NextResponse } from 'next/server';
import { PersonaAnalyzer } from '@/lib/persona-analyzer';
import { PersonaDatabase } from '@/lib/db/persona-db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, email } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    // Initialize database if needed
    await PersonaDatabase.initializeDatabase();

    // Start the analysis process (runs async)
    // Return immediately with analysis ID
    const analysis = await PersonaDatabase.createAnalysis(url, email);
    
    // Start async processing
    processAnalysisAsync(analysis.analysis_id, url, email);

    return NextResponse.json({
      analysisId: analysis.analysis_id,
      status: 'processing',
      message: 'Analysis started successfully'
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start analysis' },
      { status: 500 }
    );
  }
}

/**
 * Process analysis asynchronously
 */
async function processAnalysisAsync(analysisId: string, url: string, email?: string) {
  try {
    console.log(`Starting analysis for ${url} (ID: ${analysisId})`);
    
    // Update status to processing
    await PersonaDatabase.updateStructuredData(analysisId, {}, []);
    
    // Run the complete analysis
    const result = await PersonaAnalyzer.runCompleteAnalysis(url, email);
    
    console.log(`Analysis completed for ${url} (ID: ${analysisId})`);
    
    // If email provided, could send notification here
    if (email) {
      // TODO: Send email notification with report link
      console.log(`Would send email to ${email} with report link`);
    }
  } catch (error) {
    console.error(`Analysis failed for ${url} (ID: ${analysisId}):`, error);
    await PersonaDatabase.markFailed(
      analysisId,
      error instanceof Error ? error.message : 'Analysis failed'
    );
  }
}