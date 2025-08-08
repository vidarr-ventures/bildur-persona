// V4 Analysis Status API
import { NextRequest, NextResponse } from 'next/server';

// In-memory storage (same as start route)
declare global {
  var analysisStorage: Map<string, any>;
}

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

    return NextResponse.json({
      success: true,
      data: {
        id: analysis.id,
        status: analysis.status,
        targetUrl: analysis.targetUrl,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
        result: analysis.result,
        error: analysis.error,
      },
    });

  } catch (error) {
    console.error('Analysis status error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to get analysis status' },
      },
      { status: 500 }
    );
  }
}