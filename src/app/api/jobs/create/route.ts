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
      status: 'queued'
    });

    console.log('Job created successfully:', job.id);

    // Process with improved error handling
    processJobWithTimeout(job.id, websiteUrl, targetKeywords, amazonUrl);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      message: 'Analysis started successfully'
    });

  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json({ error: 'Failed to create analysis job' }, { status: 500 });
  }
}

async function processJobWithTimeout(jobId: string, websiteUrl: string, targetKeywords: string, amazonUrl?: string) {
  try {
    console.log(`=== Starting robust job processing for ${jobId} ===`);
    
    // Update status to processing
    await updateJobStatus(jobId, 'processing');
    console.log('Job status updated to processing');

    // Website crawling with timeout and error handling
    console.log('Starting website crawling...');
    let websiteData = null;
    
    try {
      const websiteController = new AbortController();
      const websiteTimeout = setTimeout(() => websiteController.abort(), 10000); // 10 second timeout
      
      console.log(`Crawling website: ${websiteUrl}`);
      
      const response = await fetch(websiteUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; PersonaBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: websiteController.signal
      });

      clearTimeout(websiteTimeout);
      
      if (response.ok) {
        const html = await response.text();
        console.log(`Website crawled successfully, got ${html.length} characters`);
        
        // Extract content more safely
        const cleanText = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        websiteData = {
          homePageContent: cleanText.substring(0, 2000),
          brandMessaging: 'Extracted from website',
          features: ['Website feature extraction'],
          valuePropositions: ['Value proposition analysis'],
          crawlStatus: 'success',
          contentLength: cleanText.length
        };
        
        console.log('Website data extracted successfully');
      } else {
        console.log(`Website crawling failed with status: ${response.status}`);
        websiteData = { crawlStatus: 'failed', error: `HTTP ${response.status}` };
      }
      
    } catch (websiteError) {
      console.error('Website crawling error:', websiteError);
      websiteData = { 
        crawlStatus: 'error', 
        error: websiteError instanceof Error ? websiteError.message : 'Unknown error' 
      };
    }

    // Save website data
    await saveJobData(jobId, 'website', {
      websiteData,
      metadata: { timestamp: new Date().toISOString(), websiteUrl, targetKeywords }
    });
    console.log('Website data saved');

    // Amazon reviews extraction (simplified for now)
    if (amazonUrl) {
      console.log('Starting Amazon reviews extraction...');
      try {
        const amazonData = {
          reviews: [],
          analysis: {
            totalReviews: 0,
            extractionStatus: 'MOCK_DATA',
            averageRating: 0,
            painPoints: ['Mock pain point 1', 'Mock pain point 2'],
            positives: ['Mock positive 1', 'Mock positive 2'],
            customerNeeds: ['Mock need 1', 'Mock need 2']
          }
        };
        
        await saveJobData(jobId, 'amazon_reviews', {
          reviews: amazonData.reviews,
          analysis: amazonData.analysis,
          metadata: { timestamp: new Date().toISOString(), amazonUrl, targetKeywords }
        });
        console.log('Amazon reviews data saved (mock)');
      } catch (amazonError) {
        console.error('Amazon reviews error:', amazonError);
      }
    }

    // Persona generation (simplified)
    console.log('Starting persona generation...');
    try {
      const mockPersona = {
        primaryPersona: {
          name: "Sarah Thompson",
          age: "35-45",
          title: "Health-Conscious Professional",
          painPoints: websiteData?.crawlStatus === 'success' ? 
            ["Sleep quality issues", "Natural wellness seeking", "Product authenticity concerns"] :
            ["Website analysis limited", "Data extraction challenges"],
          goals: ["Better sleep quality", "Natural health solutions", "Reliable product information"],
          characteristics: ["Research-oriented", "Quality-focused", "Health-conscious"],
          demographics: {
            income: "$75,000 - $120,000",
            location: "Urban/Suburban",
            education: "College educated"
          }
        },
        generationMethod: 'mock_with_website_data',
        websiteCrawlStatus: websiteData?.crawlStatus || 'unknown'
      };

      await saveJobData(jobId, 'persona', {
        persona: mockPersona,
        metadata: { timestamp: new Date().toISOString(), method: 'mock_generation' }
      });
      console.log('Persona data saved');

      // Complete the job
      await completeJob(jobId);
      console.log(`Job ${jobId} completed successfully`);

    } catch (personaError) {
      console.error('Persona generation error:', personaError);
      await updateJobStatus(jobId, 'failed');
    }

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'failed');
  }
}
