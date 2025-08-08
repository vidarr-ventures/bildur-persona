// V4 Report API
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

    if (analysis.status !== 'COMPLETED' || !analysis.result) {
      return NextResponse.json(
        { success: false, error: { message: 'Report not ready' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: 'report-' + analysisId,
        analysisId,
        fullReport: analysis.result.finalReport,
        summary: analysis.result.summary,
        demographics: analysis.result.extractedData?.demographics || {},
        painPoints: analysis.result.extractedData?.customer_pain_points || [],
        quotes: analysis.result.extractedData?.raw_customer_quotes || [],
        valuePropositions: analysis.result.extractedData?.value_propositions || [],
        behaviorPatterns: analysis.result.extractedData?.behavioral_patterns || [],
        generatedAt: analysis.completedAt,
      },
    });

  } catch (error) {
    console.error('Report API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to get report' },
      },
      { status: 500 }
    );
  }
}