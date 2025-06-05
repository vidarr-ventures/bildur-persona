import { NextResponse } from 'next/server';
import { Queue } from '@/lib/queue';

export async function GET() {
  try {
    const stats = await Queue.getQueueStats();
    
    return NextResponse.json({
      success: true,
      queue: {
        pending: stats.pending,
        processing: stats.processing,
        total: stats.pending + stats.processing,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue status error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to get queue status',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // Trigger queue processing
    await Queue.triggerProcessing();
    
    return NextResponse.json({
      success: true,
      message: 'Queue processing triggered manually',
    });
  } catch (error) {
    console.error('Queue trigger error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to trigger queue processing',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
