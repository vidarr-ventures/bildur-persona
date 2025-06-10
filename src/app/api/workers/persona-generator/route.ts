import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { 
      jobId, 
      websiteUrl, 
      targetKeywords, 
      amazonUrl,
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
  // Extract key insights from all data sources
  const websiteInsights = extractWebsiteInsights(data.websiteData);
  const redditInsights = extractRedditInsights(data.redditData);
  const amazonInsights = extractAmazonInsights(data.amazonReviews);
  const competitorInsights = extractCompetitorInsights(data.competitorsData);

  const prompt = `You are generating a detailed customer persona for: ${data.targetKeywords}

CRITICAL: Create a SPECIFIC, NAMED persona (like "Sarah Thompson") with detailed characteristics, NOT generic categories.

=== REAL CUSTOMER DATA SOURCES ===

${amazonInsights.available ? `
🔥 AMAZON REVIEWS DATA (PRIMARY SOURCE):
Total Reviews Analyzed: ${amazonInsights.totalReviews}
Average Rating: ${amazonInsights.averageRating}/5 stars
Verified Purchase Ratio: ${amazonInsights.verifiedRatio}%

REAL CUSTOMER PAIN POINTS FROM AMAZON:
${amazonInsights.painPoints.map((pain: string) => `• ${pain}`).join('\n')}

REAL POSITIVE FEEDBACK FROM AMAZON:
${amazonInsights.positives.map((positive: string) => `• ${positive}`).join('\n')}

CUSTOMER EMOTIONS FROM AMAZON REVIEWS:
${amazonInsights.emotions}

CUSTOMER NEEDS EXPRESSED IN AMAZON REVIEWS:
${amazonInsights.customerNeeds.map((need: string) => `• ${need}`).join('\n')}

SAMPLE ACTUAL AMAZON REVIEWS:
${amazonInsights.sampleReviews}
` : 'No Amazon reviews data available'}

${redditInsights.available ? `
SOCIAL MEDIA DISCUSSIONS (REDDIT):
Total Discussions: ${redditInsights.totalThreads}
Total Comments: ${redditInsights.totalComments}

SOCIAL PAIN POINTS:
${redditInsights.painPoints.map((pain: string) => `• ${pain}`).join('\n')}

SOCIAL SOLUTIONS MENTIONED:
${redditInsights.solutions.map((solution: string) => `• ${solution}`).join('\n')}

COMMUNITY EMOTIONS:
${redditInsights.emotions}
` : 'Limited social media data available'}

${websiteInsights.available ? `
BRAND/WEBSITE ANALYSIS:
Value Propositions: ${websiteInsights.valueProps.join(', ')}
Key Features: ${websiteInsights.features.join(', ')}
Brand Messaging: ${websiteInsights.messaging}
` : 'Limited website analysis available'}

${competitorInsights.available ? `
COMPETITIVE LANDSCAPE:
Competitor Products Analyzed: ${competitorInsights.competitorCount}
Market Positioning: ${competitorInsights.positioning}
` : 'Limited competitor analysis available'}

=== PERSONA GENERATION REQUIREMENTS ===

Based on the REAL CUSTOMER VOICE above (especially Amazon reviews), create a comprehensive persona that includes:

1. **SPECIFIC DEMOGRAPHICS**: 
   - Full name and age range
   - Income level, education, location
   - Family status and lifestyle

2. **PSYCHOGRAPHIC PROFILE**:
   - Core values and attitudes
   - Motivations and fears
   - Shopping behaviors and preferences

3. **PAIN POINTS** (based on actual customer feedback):
   - Primary problems they're trying to solve
   - Frustrations with existing solutions
   - Unmet needs and desires

4. **BEHAVIORAL PATTERNS**:
   - How they research products
   - Decision-making process
   - Purchase triggers and hesitations

5. **COMMUNICATION PREFERENCES**:
   - Language that resonates
   - Channels they use
   - Content that influences them

6. **BRAND RELATIONSHIP**:
   - How they interact with brands
   - Loyalty factors
   - Advocacy behaviors

IMPORTANT: Ground every insight in the actual customer data provided. Use specific quotes, emotions, and behaviors from the real reviews and discussions above.

Generate a detailed, evidence-based persona:`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are an expert customer research analyst who creates detailed, evidence-based customer personas. Always create specific, named personas based on real customer data, not generic categories. Use actual customer quotes and insights to support your analysis.'
          },
          {
            role: 'user',
            content: prompt
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
    const analysis = result.choices[0]?.message?.content || 'No analysis generated';

    return {
      persona: analysis,
      dataQuality: {
        confidence: calculateConfidence(amazonInsights, redditInsights, websiteInsights, competitorInsights),
        score: calculateDataScore(amazonInsights, redditInsights, websiteInsights, competitorInsights)
      },
      sources: {
        amazonReviews: amazonInsights.totalReviews || 0,
        reddit: redditInsights.totalComments || 0,
        website: websiteInsights.available ? 'analyzed' : 'limited',
        competitors: competitorInsights.available ? 'analyzed' : 'limited'
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        amazonUrl: data.amazonUrl,
        enhancedWithAmazonReviews: amazonInsights.available
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
