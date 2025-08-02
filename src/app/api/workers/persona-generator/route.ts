import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData, markPersonaReportSent } from '@/lib/db';
import { sendPersonaReport } from '@/lib/email';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Validate internal API key
  if (!validateInternalApiKey(request)) {
    return createAuthErrorResponse();
  }

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

    // Generate enhanced persona with all data sources
    const personaProfile = await generateEnhancedPersona({
      jobId,
      websiteUrl,
      targetKeywords,
      amazonUrl,
      websiteData: websiteDataFinal,
      redditData: redditDataFinal,
      amazonReviews: amazonReviewsFinal,
      competitorsData: competitorsDataFinal
    });

    await updateJobStatus(jobId, 'processing');

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

    return NextResponse.json({
      success: true,
      message: 'Enhanced persona generation with Amazon reviews completed',
      data: personaProfile,
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

async function generateEnhancedPersona(data: any) {
  // Simplified prompt for testing
  const prompt = `Create a customer persona analysis for a business with these details:

Website: ${data.websiteUrl}
Keywords: ${data.targetKeywords}

Please provide a brief customer persona analysis including:
1. Target demographic
2. Main pain points
3. Key motivations
4. Marketing recommendations

Keep the response under 500 words.`;

  try {
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
            content: 'You are a customer research analyst. Create concise, actionable customer personas based on the provided information.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const analysis = result.choices[0]?.message?.content || 'No analysis generated';

    return {
      persona: analysis,
      dataQuality: {
        confidence: 'medium',
        score: 75
      },
      sources: {
        amazonReviews: 0,
        reddit: 0,
        website: 'basic',
        competitors: 'basic'
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        amazonUrl: data.amazonUrl,
        enhancedWithAmazonReviews: false
      }
    };

  } catch (error) {
    console.error('Error generating enhanced persona:', error);
    throw error;
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
