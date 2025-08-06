import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData, markPersonaReportSent } from '@/lib/db';
import { sendPersonaReport } from '@/lib/email';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { storeJobResult } from '@/lib/job-cache';
import DemographicsFoundationProcessor from '@/lib/prompts/demographics-foundation';

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const { 
      jobId, 
      websiteUrl, 
      targetKeywords, 
      amazonUrl,
      email,
      planName,
      websiteData, 
      redditData, 
      amazonReviews, 
      competitorsData 
    } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting ENHANCED persona generation for job ${jobId} with Amazon reviews`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Use provided data OR fallback to database
    const websiteDataFinal = websiteData || await getJobData(jobId, 'website');
    const redditDataFinal = redditData || await getJobData(jobId, 'reviews');
    const amazonReviewsFinal = amazonReviews || await getJobData(jobId, 'amazon_reviews');
    const competitorsDataFinal = competitorsData || await getJobData(jobId, 'amazon_competitors');
    
    console.log('Data sources available:', {
      website: !!websiteDataFinal,
      reddit: !!redditDataFinal,
      amazonReviews: !!amazonReviewsFinal,
      competitors: !!competitorsDataFinal
    });

    // Generate sequential persona analysis starting with Demographics Foundation
    const personaProfile = await generateSequentialPersonaAnalysis({
      jobId,
      websiteUrl,
      targetKeywords,
      amazonUrl,
      websiteData: websiteDataFinal,
      redditData: redditDataFinal,
      amazonReviews: amazonReviewsFinal,
      competitorsData: competitorsDataFinal,
      youtubeData: null // Will be populated when YouTube data is available
    });

    await updateJobStatus(jobId, 'processing');

    // Store result in cache for debug dashboard
    const hasPersonaContent = personaProfile?.persona && 
                              personaProfile.persona.length > 100 && 
                              !personaProfile.error;
    
    storeJobResult(jobId, 'persona', {
      success: hasPersonaContent,
      persona: personaProfile.persona,
      stage: personaProfile.stage,
      stageNumber: personaProfile.stageNumber,
      dataQuality: personaProfile.dataQuality,
      insights: personaProfile.insights,
      metadata: personaProfile.metadata,
      processingTime: Date.now(),
      statusCode: hasPersonaContent ? 200 : 404,
      timestamp: new Date().toISOString(),
      error: hasPersonaContent ? null : 'No meaningful persona content generated',
      hasActualData: hasPersonaContent,
      dataCollected: hasPersonaContent
    });

    // Save the enhanced persona analysis
    await saveJobData(jobId, 'persona_profile', personaProfile);

    // EMAIL TEMPORARILY DISABLED FOR TESTING
    // Send email with persona report
    // if (email && personaProfile?.persona) {
    //   console.log(`Sending persona report email to ${email} for job ${jobId}`);
    //   try {
    //     const emailSent = await sendPersonaReport({
    //       jobId,
    //       email,
    //       websiteUrl: websiteUrl || 'Unknown',
    //       keywords: targetKeywords || 'Not specified',
    //       personaReport: personaProfile.persona,
    //       planName: planName || 'Standard Analysis',
    //       analysisDate: new Date().toLocaleDateString()
    //     });

    //     if (emailSent) {
    //       console.log(`✅ Email sent successfully to ${email} for job ${jobId}`);
    //       // Mark email as sent in database
    //       await markPersonaReportSent(jobId);
    //     } else {
    //       console.error(`❌ Failed to send email to ${email} for job ${jobId}`);
    //     }
    //   } catch (emailError) {
    //     console.error(`Email sending error for job ${jobId}:`, emailError);
    //   }
    // } else {
    //   console.warn(`Missing email (${email}) or persona content (${!!personaProfile?.persona}) for job ${jobId} - skipping email`);
    // }
    console.log(`Email delivery disabled for testing - persona saved for job ${jobId}`);

    await updateJobStatus(jobId, 'completed');

    console.log(`Enhanced persona generation completed for job ${jobId}`);

    const hasPersonaContent = personaProfile?.persona && 
                              personaProfile.persona.length > 100 && 
                              !personaProfile.error;

    return NextResponse.json({
      success: hasPersonaContent, // Changed: success based on meaningful content generated
      message: 'Enhanced persona generation with Amazon reviews completed',
      data: personaProfile,
      hasActualData: hasPersonaContent,
      dataCollected: hasPersonaContent
    });

  } catch (error) {
    console.error('Persona generation error:', error);
    
    try {
      const { jobId } = await request.json();
      if (jobId) {
        await updateJobStatus(jobId, 'failed');
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Persona generation failed', details: errorMessage },
      { status: 500 }
    );
  }
}

async function generateSequentialPersonaAnalysis(data: any) {
  console.log(`Starting sequential persona analysis for job ${data.jobId}`);
  
  // Stage 1: Demographics Foundation Analysis
  console.log('Running Stage 1: Demographics Foundation Analysis');
  
  const demographicsProcessor = new DemographicsFoundationProcessor();
  
  // Prepare collected data for Demographics Foundation prompt
  const collectedData = {
    amazonReviews: data.amazonReviews,
    websiteData: data.websiteData,
    competitorData: data.competitorsData,
    youtubeData: data.youtubeData,
    redditData: data.redditData,
    targetKeywords: data.targetKeywords || 'customer analysis',
    amazonUrl: data.amazonUrl,
    websiteUrl: data.websiteUrl
  };

  // Generate Demographics Foundation prompt
  const { prompt: demographicsPrompt, dataQuality } = demographicsProcessor.generatePrompt(collectedData);
  
  console.log(`Demographics Foundation prompt generated. Data quality score: ${dataQuality.quality_score}%`);
  console.log(`Total reviews analyzed: ${dataQuality.total_reviews}`);
  
  // If data quality is too low, generate a minimal persona with available data
  if (dataQuality.quality_score < 30) {
    console.warn(`⚠️ Low data quality (${dataQuality.quality_score}%) - generating basic persona with available data`);
  }

  try {
    // Call OpenAI API for Demographics Foundation analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert demographic analyst specializing in customer persona development. Follow the analysis framework exactly as specified. Use temperature 0.1 for consistent analysis.'
          },
          {
            role: 'user',
            content: demographicsPrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const demographicsAnalysis = result.choices[0]?.message?.content || 'No analysis generated';

    // Parse the response for next stage preparation
    const parsedInsights = demographicsProcessor.parseResponse(demographicsAnalysis);
    
    console.log(`Demographics Foundation analysis completed. Confidence scores:`, parsedInsights.confidence);

    // Format the complete Stage 1 report
    const stage1Report = `# STAGE 1: DEMOGRAPHICS FOUNDATION ANALYSIS
*Generated: ${new Date().toLocaleString()}*
*Data Quality Score: ${dataQuality.quality_score}% (${dataQuality.total_reviews} reviews analyzed)*

## Data Sources Summary
- Amazon Reviews: ${data.amazonReviews?.reviews?.length || 0} reviews
- Competitor Data: ${data.competitorsData?.reviews?.length || 0} reviews  
- YouTube Comments: ${data.youtubeData?.comments?.length || 0} comments
- Reddit Posts: ${data.redditData?.posts?.length || 0} posts
- Website Analysis: ${data.websiteData ? 'Available' : 'Not available'}

${dataQuality.warnings.length > 0 ? `## Data Quality Warnings\n${dataQuality.warnings.map(w => `- ${w}`).join('\n')}\n` : ''}

${demographicsAnalysis}

---

## Stage 1 Complete - Ready for Stage 2: Generational Analysis
**Next Stage Preparation:**
- Demographics confidence scores extracted
- Key findings ready for generational deep-dive
- Quote attributions tracked for transparency

*This is Stage 1 of the sequential persona analysis pipeline.*`;

    return {
      persona: stage1Report,
      stage: 'demographics_foundation',
      stageNumber: 1,
      totalStages: 9, // You mentioned 9 total stages
      dataQuality: {
        confidence: dataQuality.quality_score >= 80 ? 'high' : dataQuality.quality_score >= 60 ? 'medium' : 'low',
        score: dataQuality.quality_score,
        total_reviews: dataQuality.total_reviews,
        warnings: dataQuality.warnings
      },
      insights: parsedInsights,
      quoteAttributions: Array.from(demographicsProcessor.getQuoteAttributions().values()),
      nextStage: {
        ready: true,
        stageName: 'generational_analysis',
        stageNumber: 2,
        prepData: parsedInsights.nextStagePrep
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        amazonUrl: data.amazonUrl,
        websiteUrl: data.websiteUrl,
        sequentialAnalysis: true,
        stage: 'demographics_foundation'
      }
    };

  } catch (error) {
    console.error('Error in Demographics Foundation analysis:', error);
    
    // Return error with stage information
    return {
      persona: `# STAGE 1: DEMOGRAPHICS FOUNDATION ANALYSIS - ERROR

**Error occurred during analysis:**
${error instanceof Error ? error.message : 'Unknown error'}

**Data Available:**
- Amazon Reviews: ${data.amazonReviews?.reviews?.length || 0} reviews
- Competitor Data: ${data.competitorsData?.reviews?.length || 0} reviews  
- YouTube Comments: ${data.youtubeData?.comments?.length || 0} comments
- Reddit Posts: ${data.redditData?.posts?.length || 0} posts

This error occurred in Stage 1 of the sequential persona analysis pipeline.`,
      stage: 'demographics_foundation',
      stageNumber: 1,
      error: true,
      dataQuality: {
        confidence: 'low',
        score: 0
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        error: true
      }
    };
  }
}

function extractAmazonInsights(amazonData: any) {
  if (!amazonData || !amazonData.analysis) {
    return { available: false };
  }

  const analysis = amazonData.analysis;
  const reviews = amazonData.reviews || [];

  return {
    available: true,
    totalReviews: analysis.totalReviews || 0,
    averageRating: analysis.averageRating || 0,
    verifiedRatio: Math.round((analysis.verifiedPurchaseRatio || 0) * 100),
    painPoints: (analysis.painPoints || []).slice(0, 8),
    positives: (analysis.positives || []).slice(0, 8),
    customerNeeds: (analysis.customerNeeds || []).slice(0, 6),
    emotions: Object.entries(analysis.emotions || {})
      .filter(([emotion, count]) => (count as number) > 0)
      .map(([emotion, count]) => `${emotion}: ${count as number} mentions`)
      .join(', ') || 'No emotional data',
    sampleReviews: reviews.slice(0, 3).map((review: any) => 
      `"${review.title}" (${review.rating}/5): ${review.text.substring(0, 150)}...`
    ).join('\n\n') || 'No sample reviews'
  };
}

function extractRedditInsights(redditData: any) {
  if (!redditData || !redditData.analysis) {
    return { available: false };
  }

  const analysis = redditData.analysis;

  return {
    available: true,
    totalThreads: analysis.totalThreads || 0,
    totalComments: analysis.totalComments || 0,
    painPoints: (analysis.painPoints || []).slice(0, 6),
    solutions: (analysis.solutions || []).slice(0, 6),
    emotions: Object.entries(analysis.emotions || {})
      .filter(([emotion, count]) => (count as number) > 0)
      .map(([emotion, count]) => `${emotion}: ${count as number} mentions`)
      .join(', ') || 'No emotional data'
  };
}

function extractWebsiteInsights(websiteData: any) {
  if (!websiteData || !websiteData.analysis) {
    return { available: false };
  }

  const analysis = websiteData.analysis;

  return {
    available: true,
    valueProps: (analysis.valuePropositions || []).slice(0, 5),
    features: (analysis.features || []).slice(0, 5),
    messaging: analysis.brandMessaging || 'No brand messaging extracted'
  };
}

function extractCompetitorInsights(competitorData: any) {
  if (!competitorData || !competitorData.analysis) {
    return { available: false };
  }

  return {
    available: true,
    competitorCount: competitorData.competitors?.length || 0,
    positioning: 'Competitive analysis available'
  };
}

function calculateConfidence(amazon: any, reddit: any, website: any, competitor: any): 'high' | 'medium' | 'low' {
  let score = 0;
  
  if (amazon.available && amazon.totalReviews > 10) score += 40;
  else if (amazon.available) score += 20;
  
  if (reddit.available && reddit.totalComments > 5) score += 25;
  else if (reddit.available) score += 15;
  
  if (website.available) score += 20;
  if (competitor.available) score += 15;
  
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function calculateDataScore(amazon: any, reddit: any, website: any, competitor: any): number {
  let score = 0;
  
  if (amazon.available) score += amazon.totalReviews > 10 ? 40 : 20;
  if (reddit.available) score += reddit.totalComments > 5 ? 25 : 15;
  if (website.available) score += 20;
  if (competitor.available) score += 15;
  
  return Math.min(score, 100);
}
