import { NextRequest, NextResponse } from 'next/server';
import { createJob } from '@/lib/db';
import { JobQueue } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const {
      primaryProductUrl,
      amazonProductUrl,
      targetKeywords,
      competitors,
      userProduct,
      businessType,
      targetMarket
    } = body;
    
    if (!primaryProductUrl || !targetKeywords || !userProduct) {
      return NextResponse.json(
        { error: 'Missing required fields: primaryProductUrl, targetKeywords, and userProduct are required' },
        { status: 400 }
      );
    }
    
    console.log('Creating new job with data:', {
      primaryProductUrl,
      amazonProductUrl: amazonProductUrl || 'Not provided',
      targetKeywords,
      userProduct,
      businessType: businessType || 'Not specified',
      targetMarket: targetMarket || 'Not specified'
    });
    
    // Create job in database - createJob returns the jobId directly
    const jobId = await createJob({
      primaryProductUrl,
      amazonProductUrl,
      targetKeywords,
      competitors: competitors || [],
      userProduct,
      businessType,
      targetMarket
    });
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Failed to create job' },
        { status: 500 }
      );
    }
    
    console.log(`Created job ${jobId}, queuing initial tasks`);
    
    // Initialize job queue
    const queue = new JobQueue();
    
    // Queue all the worker tasks in the correct order
    const tasks = [];
    
    // 1. Website crawler - crawl the user's own website first
    tasks.push(queue.addJob(jobId, 'website-crawler', {
      primaryProductUrl,
      targetKeywords,
      userProduct,
      businessType,
      targetMarket
    }));
    
    // 2. Amazon competitors (if Amazon URL provided)
    if (amazonProductUrl) {
      tasks.push(queue.addJob(jobId, 'amazon-competitors', {
        amazonProductUrl,
        targetKeywords,
        userProduct
      }));
    }
    
    // 3. Google competitors
    tasks.push(queue.addJob(jobId, 'google-competitors', {
      primaryProductUrl,
      targetKeywords,
      competitors: competitors || [],
      userProduct
    }));
    
    // 4. Reddit data collection
    tasks.push(queue.addJob(jobId, 'reviews-collector', {
      targetKeywords,
      userProduct,
      primaryProductUrl
    }));
    
    // Wait for all initial tasks to be queued
    await Promise.all(tasks);
    
    console.log(`Successfully queued ${tasks.length} initial tasks for job ${jobId}`);
    
    // Return job ID for tracking
    return NextResponse.json({
      success: true,
      jobId,
      status: 'pending',
      message: `Job created successfully. Processing ${tasks.length} data collection tasks.`,
      tasksQueued: tasks.length
    });

  } catch (error) {
    console.error('Error creating job:', error);
    
    return NextResponse.json(
      { error: 'Failed to create job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
