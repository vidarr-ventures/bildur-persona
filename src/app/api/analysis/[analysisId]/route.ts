// Fresh API endpoint to fetch analysis results
import { NextRequest, NextResponse } from 'next/server';
import { getAnalysis } from '../../../../lib/database';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ analysisId: string }> }
) {
  const { analysisId } = await context.params;

  try {
    const analysis = await getAnalysis(analysisId);
    
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('[API] Error fetching analysis:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}