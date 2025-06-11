import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, saveJobData, completeJob } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const websiteUrl = body.primaryProductUrl;
    const amazonUrl = body.amazonProductUrl;
    const targetKeywords = body.targetKeywords;

    console.log('Creating job with data:', { websiteUrl, targetKeywords, amazonUrl });

    // Create job in database
    const job = await createJob({
      website_url: websiteUrl,
      target_keywords: targetKeywords,
      amazon_url: amazonUrl || null,
      status: 'pending'
    });

    console.log('Job created successfully:', job.id);

    // Process inline and wait for completion
    await processJobInline(job.id, websiteUrl, targetKeywords, amazonUrl);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Analysis completed successfully'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json({ error: 'Failed to create analysis job' }, { status: 500 });
  }
}

async function processJobInline(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`=== Starting inline job processing for ${jobId} ===`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    
    // Website crawling inline
    console.log('Starting website crawling...');
    const websiteData = await crawlWebsite(websiteUrl);
    await saveJobData(jobId, 'website', {
      websiteData,
      metadata: { timestamp: new Date().toISOString(), websiteUrl, targetKeywords }
    });
    console.log('Website crawling completed');

    // Amazon reviews extraction inline
    if (amazonUrl) {
      console.log('Starting Amazon reviews extraction...');
      const amazonData = await extractAmazonReviews(amazonUrl, targetKeywords);
      await saveJobData(jobId, 'amazon_reviews', {
        reviews: amazonData.reviews,
        analysis: amazonData.analysis,
        metadata: { timestamp: new Date().toISOString(), amazonUrl, targetKeywords }
      });
      console.log('Amazon reviews extraction completed');
    }

    // Persona generation inline
    console.log('Starting persona generation...');
    const personaData = await generatePersona(jobId, websiteUrl, targetKeywords, amazonUrl);
    
    // Complete the job
    await completeJob(jobId);
    console.log(`Job ${jobId} completed successfully`);

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
    throw error; // Re-throw to be caught by the main function
  }
}

async function crawlWebsite(websiteUrl: string) {
  try {
    console.log(`Crawling website: ${websiteUrl}`);
    
    const response = await fetch(websiteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)' }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch website: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Successfully fetched ${html.length} characters from ${websiteUrl}`);
    
    // Extract main content
    let content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    content = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log(`Extracted ${content.length} characters of clean content`);
    
    return {
      homePageContent: content.substring(0, 2000),
      brandMessaging: 'Extracted brand messaging',
      features: ['Feature 1', 'Feature 2'],
      valuePropositions: ['Value prop 1', 'Value prop 2']
    };

  } catch (error) {
    console.error('Website crawling error:', error);
    throw error; // Re-throw to propagate the error
  }
}

async function extractAmazonReviews(amazonUrl: string, targetKeywords: string) {
  try {
    console.log(`Extracting Amazon reviews from: ${amazonUrl}`);
    
    // For now, return mock data since ScrapeOwl might not be configured
    return {
      reviews: [],
      analysis: {
        totalReviews: 0,
        extractionStatus: 'NO_API_KEY',
        averageRating: 0,
        painPoints: [],
        positives: [],
        customerNeeds: []
      }
    };

  } catch (error) {
    console.error('Amazon extraction error:', error);
    return {
      reviews: [],
      analysis: {
        totalReviews: 0,
        extractionStatus: 'FAILED',
        averageRating: 0,
        painPoints: [],
        positives: [],
        customerNeeds: []
      }
    };
  }
}

async function generatePersona(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`Generating persona for job ${jobId}`);
    
    // Mock persona generation for now
    const mockPersona = {
      primaryPersona: {
        name: "Sarah Thompson",
        age: "35-45",
        title: "Health-Conscious Professional",
        painPoints: ["Sleep issues", "Stress management", "Natural wellness"],
        goals: ["Better sleep quality", "Reduced inflammation", "Natural health solutions"],
        characteristics: ["Research-oriented", "Values quality", "Wellness-focused"]
      }
    };

    await saveJobData(jobId, 'persona', {
      persona: mockPersona,
      metadata: { timestamp: new Date().toISOString(), method: 'mock_generation' }
    });

    console.log(`Persona generation completed for job ${jobId}`);
    return mockPersona;

  } catch (error) {
    console.error('Persona generation error:', error);
    throw error;
  }
}
