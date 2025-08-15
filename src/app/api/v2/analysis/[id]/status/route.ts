// V4 Status Check API
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

    return NextResponse.json({
      success: true,
      data: {
        analysisId,
        status: analysis.status,
        startedAt: analysis.startedAt,
        completedAt: analysis.completedAt,
        steps: analysis.steps?.map((step: any) => ({
          name: step.name,
          status: step.status,
        })),
      },
    });

  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { message: 'Failed to get status' },
      },
      { status: 500 }
    );
  }
}