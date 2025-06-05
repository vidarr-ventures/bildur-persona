import { NextResponse } from 'next/server';
import { Queue } from '@/lib/queue';

export async function POST() {
  try {
    console.log('Starting queue cleanup...');
    
    // Process any retryable/stuck jobs
    await Queue.processRetryableJobs();
    
    // Get updated stats
    const stats = await Queue.getQueueStats();
    
    return NextResponse.json({
      success: true,
      message: 'Queue cleanup completed',
      stats: {
        pending: stats.pending,
        processing: stats.processing,
      },
    });
  } catch (error) {
    console.error('Queue cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Queue cleanup failed',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const stats = await Queue.getQueueStats();
    
    return NextResponse.json({
      success: true,
      cleanup_needed: stats.processing > 0,
      recommendations: stats.processing > 0 
        ? ['Run POST /api/queue/cleanup to process stuck jobs']
        : ['Queue is healthy, no cleanup needed'],
      stats,
    });
  } catch (error) {
    console.error('Queue cleanup check error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to check cleanup status',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}
