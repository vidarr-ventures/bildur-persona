import { NextRequest, NextResponse } from 'next/server';
import { PersonaDatabase } from '@/lib/db/persona-db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string }> }
) {
  try {
    const { analysisId } = await params;

    if (!analysisId) {
      return NextResponse.json(
        { error: 'Analysis ID is required' },
        { status: 400 }
      );
    }

    // Get analysis from database
    const analysis = await PersonaDatabase.getAnalysis(analysisId);

    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Get analysis error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}