// V4 Debug API
import { NextRequest, NextResponse } from 'next/server';

const getStorage = () => {
  if (!global.analysisStorage) {
    global.analysisStorage = new Map();
  }
  return global.analysisStorage;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const analysisId = resolvedParams.id;
    const storage = getStorage();
    const analysis = storage.get(analysisId);

    if (!analysis) {
      return NextResponse.json(
        { success: false, error: { message: 'Analysis not found' } },
        { status: 404 }
      );
    }

    // Format debug data for the frontend
    const debugData = {
      analysisId: analysis.id,
      status: analysis.status,
      totalDuration: analysis.completedAt && analysis.startedAt 
        ? `${Math.round((new Date(analysis.completedAt).getTime() - new Date(analysis.startedAt).getTime()) / 1000)}s`
        : 'In progress',
      errorCount: analysis.error ? 1 : 0,
      steps: analysis.steps.map((step: any, index: number) => ({
        name: step.name,
        order: index + 1,
        status: step.status,
        duration: step.completedAt && step.startedAt
          ? `${Math.round((new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 1000)}s`
          : null,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        hasError: false,
        input: step.input || null,
        output: step.output || null,
      })),
      report: analysis.result ? {
        id: 'report-' + analysis.id,
        fullReport: analysis.result.finalReport,
        summary: analysis.result.summary,
        personaData: analysis.result.extractedData,
        quotes: analysis.result.extractedData?.raw_customer_quotes || [],
        insightCount: (analysis.result.extractedData?.customer_pain_points?.length || 0) + 
                      (analysis.result.extractedData?.raw_customer_quotes?.length || 0),
        topQuotes: analysis.result.extractedData?.raw_customer_quotes?.slice(0, 3) || [],
        reportValid: !!analysis.result.finalReport,
      } : null,
      errors: analysis.error ? [{ message: analysis.error }] : [],
    };

    return NextResponse.json({
      success: true,
      data: debugData,
    });

  } catch (error) {
    console.error('Debug API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to get debug data' },
      },
      { status: 500 }
    );
  }
}