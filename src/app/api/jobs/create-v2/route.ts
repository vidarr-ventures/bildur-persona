import { NextRequest, NextResponse } from 'next/server';
import { createJob, updateJobStatus, saveJobData, completeJob } from '@/lib/db';

// OxyLabs Amazon extraction function with timeout and proper error handling
async function extractMultiPageAmazonReviews(amazonUrl: string, targetKeywords: string) {
  const timeout = 60000; // 60 second timeout
  
  try {
    console.log(`OxyLabs Amazon extraction from: ${amazonUrl}`);
    
    // Extract ASIN
    const asinMatch = amazonUrl.match(/\/dp\/([A-Z0-9]{10})/i) || 
                     amazonUrl.match(/\/product\/([A-Z0-9]{10})/i) ||
                     amazonUrl.match(/asin=([A-Z0-9]{10})/i);
    
    if (!asinMatch) {
      throw new Error('Could not extract ASIN from Amazon URL');
    }
    
    const asin = asinMatch[1];
    console.log(`Extracted ASIN: ${asin}`);
    
    // Temporarily disable OxyLabs to preserve trial credits
    const OXYLABS_DISABLED = true;
    
    if (OXYLABS_DISABLED) {
      console.log('OxyLabs temporarily disabled - using mock data to preserve trial credits');
      
      // Return mock data that matches the real structure
      return {
        reviews: [
          {
            title: '5.0 out of 5 stars Amazing results!',
            text: 'This product has changed my sleep quality dramatically. I used to wake up multiple times but now sleep through the night.',
            rating: 5,
            verified: true,
            helpful_votes: 12,
            date: '',
            reviewer_name: 'Mock Customer',
            source: 'mock_oxylabs',
            page: 1
          },
          {
            title: '4.0 out of 5 stars Good but expensive',
            text: 'The quality is excellent and I do notice better sleep, but the price point is quite high for what it is.',
            rating: 4,
            verified: true,
            helpful_votes: 8,
            date: '',
            reviewer_name: 'Mock Reviewer',
            source: 'mock_oxylabs',
            page: 1
          }
        ],
        productInfo: {
          title: 'Mock Product Title',
          overallRating: 4.2,
          totalReviews: 500,
          price: 179.99,
          asin: asin
        },
        extractionMethod: 'mock_oxylabs_disabled',
        realReviewsCount: 2,
        success: true
      };
    }
    
    // Check for OxyLabs credentials
    if (!process.env.OXYLABS_USERNAME || !process.env.OXYLABS_PASSWORD) {
      throw new Error('Missing OxyLabs credentials (OXYLABS_USERNAME or OXYLABS_PASSWORD)');
    }
    
    console.log('Attempting OxyLabs extraction...');
    
    let productInfo: any = {};
    let allReviews: any[] = [];
    
    // Product information with timeout
    console.log('Getting product information...');
    const productController = new AbortController();
    const productTimeout = setTimeout(() => productController.abort(), timeout);
    
    try {
      const productResponse = await fetch('https://realtime.oxylabs.io/v1/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${process.env.OXYLABS_USERNAME}:${process.env.OXYLABS_PASSWORD}`).toString('base64')
        },
        body: JSON.stringify({
          source: 'amazon_product',
          query: asin,
          geo_location: '90210',
          parse: true
        }),
        signal: productController.signal
      });

      clearTimeout(productTimeout);

      if (!productResponse.ok) {
        throw new Error(`OxyLabs product API failed with status ${productResponse.status}`);
      }

      const productData = await productResponse.json();
      console.log('OxyLabs product response status:', productData.status);
      
      if (productData.results && productData.results[0] && productData.results[0].content) {
        const result = productData.results[0];
        productInfo = {
          title: result.content?.title || 'Unknown Product',
          overallRating: result.content?.rating || 'Unknown',
          totalReviews: result.content?.reviews_count || 'Unknown',
          price: result.content?.price || 'Unknown',
          asin: asin
        };
        
        console.log(`Product: ${productInfo.title}, Reviews: ${productInfo.totalReviews}`);
      } else {
        throw new Error('Invalid product data structure from OxyLabs');
      }
    } catch (error) {
      clearTimeout(productTimeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Product information request timed out');
      }
      throw error;
    }

    // Reviews with timeout
    console.log('Getting product reviews...');
    const reviewsController = new AbortController();
    const reviewsTimeout = setTimeout(() => reviewsController.abort(), timeout);
    
    try {
      const reviewsResponse = await fetch('https://realtime.oxylabs.io/v1/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`${process.env.OXYLABS_USERNAME}:${process.env.OXYLABS_PASSWORD}`).toString('base64')
        },
        body: JSON.stringify({
          source: 'amazon_reviews',
          query: asin,
          geo_location: '90210',
          parse: true,
          limit: 50
        }),
        signal: reviewsController.signal
      });

      clearTimeout(reviewsTimeout);

      if (!reviewsResponse.ok) {
        throw new Error(`OxyLabs reviews API failed with status ${reviewsResponse.status}`);
      }

      const reviewsData = await reviewsResponse.json();
      console.log('OxyLabs reviews response status:', reviewsData.status);
      
      if (reviewsData.results && reviewsData.results[0] && reviewsData.results[0].content) {
        const reviews = reviewsData.results[0].content.reviews || [];
        console.log(`Found ${reviews.length} reviews from OxyLabs`);
        
        if (reviews.length === 0) {
          throw new Error('No reviews found for this product');
        }
        
        allReviews = reviews.map((review: any, index: number) => ({
          title: review.title || '',
          text: review.text || review.content || '',
          rating: review.rating || 3,
          verified: review.is_verified || false,
          helpful_votes: review.helpful_count || 0,
          date: review.date || '',
          reviewer_name: review.author || 'Anonymous',
          source: 'amazon_oxylabs',
          page: Math.floor(index / 20) + 1
        })).filter((review: any) => review.text && review.text.length > 15);
        
        console.log(`Processed ${allReviews.length} valid reviews`);
        
        if (allReviews.length === 0) {
          throw new Error('No valid reviews after filtering');
        }
      } else {
        throw new Error('Invalid reviews data structure from OxyLabs');
      }
    } catch (error) {
      clearTimeout(reviewsTimeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Reviews request timed out');
      }
      throw error;
    }
    
    console.log(`OxyLabs extraction completed successfully: ${allReviews.length} total reviews`);
    
    return {
      reviews: allReviews,
      productInfo: productInfo,
      extractionMethod: 'oxylabs_success',
      realReviewsCount: allReviews.length,
      success: true
    };
    
  } catch (error) {
    console.error('Critical error in OxyLabs Amazon extraction:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error in Amazon extraction');
  }
}

// YouTube extraction function (embedded directly)
async function extractYouTubeComments(keywords: string): Promise<{ comments: any[], analysis: any }> {
  try {
    console.log(`Searching YouTube for videos about: ${keywords}`);
    
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('Missing YouTube API key');
    }

    // Search for relevant videos
    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&type=video&q=${encodeURIComponent(keywords)}&` +
      `maxResults=5&order=relevance&key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!searchResponse.ok) {
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const videos = searchData.items || [];
    console.log(`Found ${videos.length} videos`);
    
    if (videos.length === 0) {
      throw new Error('No YouTube videos found for keywords');
    }
    
    let allComments: any[] = [];
    const videoTitles: string[] = [];
    
    // Extract comments from top 3 videos
    for (const video of videos.slice(0, 5)) {
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      videoTitles.push(videoTitle);
      
      console.log(`Extracting comments from: ${videoTitle}`);
      
      try {
        const commentsResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/commentThreads?` +
          `part=snippet&videoId=${videoId}&maxResults=50&order=relevance&` +
          `key=${process.env.YOUTUBE_API_KEY}`
        );

        if (commentsResponse.ok) {
          const commentsData = await commentsResponse.json();
          
          if (commentsData.items) {
            for (const item of commentsData.items) {
              const comment = item.snippet.topLevelComment.snippet;
              
              // Filter for substantive comments
              if (comment.textDisplay.length > 30) {
                allComments.push({
                  text: comment.textDisplay,
                  author: comment.authorDisplayName,
                  likeCount: comment.likeCount || 0,
                  publishedAt: comment.publishedAt,
                  videoTitle: videoTitle,
                  videoId: videoId,
                  source: 'youtube_api'
                });
              }
            }
          }
        }
      } catch (videoError) {
        console.error(`Error extracting comments from video ${videoId}:`, videoError);
      }
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Total YouTube comments extracted: ${allComments.length}`);
    
    // Analyze comments
    const allText = allComments.map(c => c.text).join(' ').toLowerCase();
    
    const analysis = {
      totalComments: allComments.length,
      extractionStatus: allComments.length > 0 ? 'SUCCESS' : 'NO_COMMENTS_FOUND',
      painPoints: extractYouTubePainPoints(allText),
      desires: extractYouTubeDesires(allText),
      frustrations: extractYouTubeFrustrations(allText),
      emotions: analyzeYouTubeEmotions(allText),
      topVideos: videoTitles
    };
    
    return {
      comments: allComments.slice(0, 45), // Keep top 15 comments
      analysis: analysis
    };
    
  } catch (error) {
    console.error('YouTube comments extraction error:', error);
    throw error;
  }
}

function extractYouTubePainPoints(text: string): string[] {
  const patterns = [
    /(?:i have|suffering from|struggle with|problem with|can't sleep|insomnia|pain|inflammation)[\s\w]{20,100}/gi,
    /(?:chronic|constant|every night|always tired|can't seem to)[\s\w]{20,100}/gi
  ];
  
  const pains: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 8));
  });
  
  return [...new Set(pains)].slice(0, 10);
}

function extractYouTubeDesires(text: string): string[] {
  const patterns = [
    /(?:i want|i need|i wish|hoping for|looking for|trying to find)[\s\w]{20,100}/gi,
    /(?:would love to|desperately need|if only)[\s\w]{15,80}/gi
  ];
  
  const desires: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    desires.push(...matches.slice(0, 8));
  });
  
  return [...new Set(desires)].slice(0, 10);
}

function extractYouTubeFrustrations(text: string): string[] {
  const patterns = [
    /(?:frustrated|annoying|hate|tired of|sick of|nothing works)[\s\w]{20,100}/gi,
    /(?:tried everything|doesn't work|waste of money|disappointed)[\s\w]{15,80}/gi
  ];
  
  const frustrations: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    frustrations.push(...matches.slice(0, 8));
  });
  
  return [...new Set(frustrations)].slice(0, 10);
}

function analyzeYouTubeEmotions(text: string): Record<string, number> {
  return {
    desperation: (text.match(/desperate|hopeless|lost|don't know what to do/g) || []).length,
    hope: (text.match(/hope|hopeful|optimistic|excited/g) || []).length,
    frustration: (text.match(/frustrated|annoying|hate|angry/g) || []).length,
    relief: (text.match(/relief|finally|thank god|breakthrough/g) || []).length,
    skepticism: (text.match(/skeptical|doubt|suspicious|not sure/g) || []).length
  };
}

// Analyze reviews function
function analyzeReviews(reviews: any[], productInfo: any, targetKeywords: string) {
  const totalReviews = reviews.length;
  
  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      extractionStatus: 'NO_REVIEWS_FOUND',
      averageRating: 0,
      painPoints: [],
      positives: [],
      customerNeeds: [],
      emotions: {},
      verifiedPurchaseRatio: 0
    };
  }
  
  const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews;
  const verifiedCount = reviews.filter(r => r.verified).length;
  const verifiedRatio = verifiedCount / totalReviews;
  
  // Combine all review text for analysis
  const allText = reviews.map(r => `${r.title} ${r.text}`).join(' ').toLowerCase();
  
  // Extract insights
  const painPoints = extractPainPoints(allText);
  const positives = extractPositives(allText);
  const customerNeeds = extractNeeds(allText);
  const emotions = analyzeEmotions(allText);
  
  return {
    totalReviews,
    extractionStatus: 'SUCCESS',
    averageRating: Math.round(averageRating * 10) / 10,
    painPoints,
    positives,
    customerNeeds,
    emotions,
    verifiedPurchaseRatio: Math.round(verifiedRatio * 100) / 100,
    productInfo,
    sampleReviews: reviews.slice(0, 5).map(r => ({
      title: r.title,
      rating: r.rating,
      text: r.text.substring(0, 200) + '...',
      verified: r.verified,
      source: r.source
    }))
  };
}

function extractPainPoints(text: string): string[] {
  const patterns = [
    /(?:problem with|issue with|trouble with|doesn't work|not working|failed to|disappointed|poor quality)[\s\w]{20,100}/gi,
    /(?:uncomfortable|too small|too large|doesn't fit|wrong size|cheap material)[\s\w]{15,80}/gi
  ];
  
  const pains: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 10));
  });
  
  return [...new Set(pains)].slice(0, 15);
}

function extractPositives(text: string): string[] {
  const patterns = [
    /(?:love|amazing|excellent|perfect|great|wonderful|impressed|happy|satisfied|recommend)[\s\w]{20,100}/gi,
    /(?:comfortable|soft|good quality|works well|sleep better|worth it)[\s\w]{15,80}/gi
  ];
  
  const positives: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    positives.push(...matches.slice(0, 10));
  });
  
  return [...new Set(positives)].slice(0, 15);
}

function extractNeeds(text: string): string[] {
  const patterns = [
    /(?:need|want|looking for|trying to|hope to|wish)[\s\w]{15,80}/gi
  ];
  
  const needs: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    needs.push(...matches.slice(0, 8));
  });
  
  return [...new Set(needs)].slice(0, 10);
}

function analyzeEmotions(text: string): Record<string, number> {
  return {
    satisfaction: (text.match(/love|great|amazing|excellent|perfect|satisfied|happy/g) || []).length,
    frustration: (text.match(/frustrated|annoying|hate|terrible|awful|disappointed/g) || []).length,
    relief: (text.match(/relief|finally|thank god|godsend|lifesaver|game changer/g) || []).length,
    skepticism: (text.match(/skeptical|doubt|suspicious|not sure|questionable/g) || []).length
  };
}

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

    // Amazon reviews extraction using OxyLabs
    if (amazonUrl) {
      console.log('Starting Amazon reviews extraction with OxyLabs...');
      try {
        const amazonResult = await extractMultiPageAmazonReviews(amazonUrl, targetKeywords);
        const analysis = analyzeReviews(amazonResult.reviews, amazonResult.productInfo, targetKeywords);
        
        await saveJobData(jobId, 'amazon_reviews', {
          reviews: amazonResult.reviews,
          analysis: analysis,
          productInfo: amazonResult.productInfo,
          metadata: { 
            timestamp: new Date().toISOString(), 
            amazonUrl, 
            targetKeywords,
            extractionMethod: amazonResult.extractionMethod,
            realReviewsCount: amazonResult.realReviewsCount
          }
        });
        
        console.log(`Amazon reviews extraction completed: ${amazonResult.realReviewsCount} reviews`);
      } catch (amazonError) {
        console.error('Amazon extraction failed:', amazonError);
        await updateJobStatus(jobId, 'failed');
        const errorMessage = amazonError instanceof Error ? amazonError.message : 'Unknown error';
        throw new Error(`Amazon review extraction failed: ${errorMessage}`);
      }
    }

    // YouTube comments extraction
    console.log('Starting YouTube comments extraction...');
    try {
      const youtubeResult = await extractYouTubeComments(targetKeywords);
      
      await saveJobData(jobId, 'youtube_comments', {
        comments: youtubeResult.comments,
        analysis: youtubeResult.analysis,
        metadata: { 
          timestamp: new Date().toISOString(), 
          keywords: targetKeywords,
          extractionMethod: 'youtube_api',
          totalCommentsFound: youtubeResult.comments.length,
          videosAnalyzed: youtubeResult.analysis.topVideos.length
        }
      });
      
      console.log(`YouTube comments extraction completed: ${youtubeResult.comments.length} comments`);
    } catch (youtubeError) {
      console.error('YouTube extraction failed:', youtubeError);
      // Don't fail the entire job for YouTube - it's supplementary data
      console.log('Continuing job without YouTube data...');
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
    throw error;
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
    throw error;
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