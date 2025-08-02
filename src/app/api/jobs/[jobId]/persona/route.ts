import { NextRequest, NextResponse } from 'next/server';
import { getPersonaByJobId } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching persona for job ID: ${jobId}`);
    
    // Get persona data from database
    const personaData = await getPersonaByJobId(jobId);
    
    if (!personaData) {
      console.log(`No persona found for job ID: ${jobId}`);
      return NextResponse.json(
        { 
          persona: null,
          message: 'Persona not yet generated' 
        },
        { status: 200 }
      );
    }

    console.log(`Found persona for job ID: ${jobId}, status: ${personaData.status}`);
    
    // Return the persona data in the expected format
    return NextResponse.json({
      persona: personaData.persona,
      status: personaData.status,
      dataQuality: personaData.data_quality,
      createdAt: personaData.created_at,
      updatedAt: personaData.updated_at
    });
    
  } catch (error) {
    console.error('Error fetching persona:', error);
    return NextResponse.json(
      { error: 'Failed to fetch persona' },
      { status: 500 }
    );
  }
}