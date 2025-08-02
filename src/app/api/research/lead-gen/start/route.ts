import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData, createResearchRequest } from '@/lib/db';
import { PRICING_PLANS } from '@/lib/stripe';
import { sql } from '@vercel/postgres';
import { storeJobData } from '@/lib/job-cache';
import { v4 as uuidv4 } from 'uuid';
// TEMPORARILY DISABLED: import { Queue } from '@/lib/queue';

async function callWorkersDirectly(jobId: string, websiteUrl: string, keywords: string, amazonUrl?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://persona.bildur.ai';
  const internalApiKey = process.env.INTERNAL_API_KEY;
  
  console.log(`Calling workers for job ${jobId} with Amazon URL: ${amazonUrl}`);
  
  const workers = [
    { name: 'amazon-reviews', endpoint: '/api/workers/amazon-reviews' },
    { name: 'youtube-comments', endpoint: '/api/workers/youtube-comments' },
    { name: 'website-crawler', endpoint: '/api/workers/website-crawler' },
    { name: 'persona-generator', endpoint: '/api/workers/persona-generator' }
  ];
  
  for (const worker of workers) {
    try {
      console.log(`Calling ${worker.name} worker...`);
      
      const requestData = {
        jobId,
        websiteUrl,
        targetKeywords: keywords,
        keywords: keywords, // YouTube worker expects 'keywords'
        amazonUrl: amazonUrl || '', // Ensure amazonUrl is at root level
        planName: PRICING_PLANS[planId as keyof typeof PRICING_PLANS]?.name || 'Essential'
      };
      
      console.log(`=== SENDING TO ${worker.name.toUpperCase()} WORKER ===`);
      console.log('Request data being sent:', JSON.stringify(requestData, null, 2));
      console.log('Amazon URL being sent:', amazonUrl);
      console.log('Amazon URL type:', typeof amazonUrl);
      
      const response = await fetch(`${baseUrl}${worker.endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${internalApiKey}`,
        },
        body: JSON.stringify(requestData),
      });
      
      const result = await response.json();
      console.log(`${worker.name} result:`, result);
      
    } catch (error) {
      console.error(`Error calling ${worker.name}:`, error);
    }
  }
}

interface ResearchRequest {
  websiteUrl: string;
  amazonUrl?: string;
  keywords: string;
  email: string;
  competitorUrls?: string[];
  planId: string;
  discountCode?: string;
  paymentSessionId: string;
  amountPaid: number;
  originalPrice: number;
  finalPrice: number;
  isFree?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    // TEMPORARILY DISABLED: Check for internal API key (for webhook and free order calls)
    // const authHeader = request.headers.get('authorization');
    // const isInternalCall = authHeader?.startsWith('Bearer ') && 
    //                       authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY;
    const isInternalCall = true; // Allow all calls for testing

    const body: ResearchRequest = await request.json();
    const {
      websiteUrl,
      amazonUrl,
      keywords,
      email,
      competitorUrls = [],
      planId,
      discountCode,
      paymentSessionId,
      amountPaid,
      originalPrice,
      finalPrice,
      isFree = false
    } = body;

    // Validate required fields
    if (!websiteUrl || !email || !keywords) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // For non-internal calls, verify payment (future enhancement)
    if (!isInternalCall && !isFree) {
      // TODO: Add payment verification logic here
      console.log('Payment verification would happen here for paid orders');
    }

    // Create a proper UUID job ID
    const jobId = uuidv4();

    console.log(`Starting research job ${jobId} for ${email}`);
    console.log(`Plan: ${planId}, Amount: $${finalPrice/100}, Free: ${isFree}`);

    // DETAILED DEBUGGING FOR AMAZON URL
    console.log('=== LEAD-GEN AMAZON URL DEBUGGING ===');
    console.log('Amazon URL received:', amazonUrl);
    console.log('Amazon URL type:', typeof amazonUrl);
    console.log('Amazon URL length:', amazonUrl?.length);
    console.log('Amazon URL isEmpty:', !amazonUrl || amazonUrl.trim() === '');
    console.log('Full request body:', JSON.stringify(body, null, 2));

    // STORE JOB DATA IN CACHE (bypass database issues)
    console.log('Storing job data in cache...');
    console.log(`Generated jobId: ${jobId}`);
    
    storeJobData({
      jobId,
      websiteUrl,
      amazonUrl: amazonUrl || '',
      keywords,
      email,
      competitorUrls,
      planId,
      planName: PRICING_PLANS[planId as keyof typeof PRICING_PLANS]?.name || planId
    });
    console.log('Job data stored in cache successfully');
    
    // Also try database (but don't fail if it doesn't work)
    try {
      await createResearchRequest({
        jobId,
        websiteUrl,
        amazonUrl: amazonUrl || '',
        keywords,
        email,
        competitorUrls,
        planId,
        planName: PRICING_PLANS[planId as keyof typeof PRICING_PLANS]?.name || planId,
        discountCode,
        paymentSessionId,
        amountPaid,
        originalPrice,
        finalPrice,
        isFree
      });
      console.log('Database record also created successfully');
    } catch (dbError) {
      console.error('Database failed (using cache instead):', dbError instanceof Error ? dbError.message : 'Unknown error');
      // Continue with cache data
    }
    
    // Call workers directly for testing
    setTimeout(async () => {
      try {
        console.log('=== BEFORE CALLING WORKERS ===');
        console.log('jobId:', jobId);
        console.log('websiteUrl:', websiteUrl);
        console.log('keywords:', keywords);
        console.log('amazonUrl variable:', amazonUrl);
        console.log('amazonUrl type:', typeof amazonUrl);
        console.log('amazonUrl length:', amazonUrl?.length);
        console.log('===============================');
        
        await callWorkersDirectly(jobId, websiteUrl, keywords, amazonUrl);
      } catch (error) {
        console.error('Error calling workers directly:', error);
      }
    }, 2000); // Small delay to let the response return first

    console.log('About to return response with jobId:', jobId);
    
    const responseData = {
      success: true,
      jobId,
      message: 'Research job started successfully',
      redirectUrl: `/dashboard/${jobId}`,
      data: {
        jobId,
        email,
        planId,
        isFree,
        estimatedCompletion: '5-8 minutes'
      }
    };
    
    console.log('Full response data:', JSON.stringify(responseData));
    
    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Research start error:', error);
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json(
      { error: 'TESTING MODE: lead-gen bypass failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}