import { NextResponse } from 'next/server';
import { PersonaDatabase } from '@/lib/db/persona-db';

export async function GET() {
  try {
    // Initialize database
    await PersonaDatabase.initializeDatabase();
    
    // Test creating an analysis
    const testAnalysis = await PersonaDatabase.createAnalysis(
      'https://example.com',
      'test@example.com'
    );
    
    // Test updating with structured data
    const updatedAnalysis = await PersonaDatabase.updateStructuredData(
      testAnalysis.analysis_id,
      {
        demographics: { age_range: '25-45' },
        pain_points: ['test pain point'],
        motivations: ['test motivation'],
        behaviors: [],
        preferred_channels: [],
        values: [],
        objections: [],
        decision_factors: []
      },
      [
        {
          source: 'test',
          quote: 'test quote',
          context: 'test context'
        }
      ]
    );
    
    // Test final report update
    const finalAnalysis = await PersonaDatabase.updatePersonaReport(
      testAnalysis.analysis_id,
      'This is a test persona report generated during database verification.'
    );
    
    // Test retrieval
    const retrievedAnalysis = await PersonaDatabase.getAnalysis(testAnalysis.analysis_id);
    
    return NextResponse.json({
      success: true,
      message: 'Database test completed successfully',
      testResults: {
        created: testAnalysis,
        updated: updatedAnalysis,
        final: finalAnalysis,
        retrieved: retrievedAnalysis
      }
    });
  } catch (error) {
    console.error('Database test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Database test failed'
    }, { status: 500 });
  }
}