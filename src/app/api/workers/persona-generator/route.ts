import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData } from '@/lib/db';

interface DataQuality {
  score: number;
  strengths: string[];
  limitations: string[];
  confidence: 'high' | 'medium' | 'low';
}

function validateDataQuality(reviews: any[], website: any, reddit: any, competitors: any): DataQuality {
  const sources = [reviews, website, reddit, competitors].filter(Boolean);
  const score = (sources.length / 4) * 100;
  
  const strengths = [];
  const limitations = [];
  
  if (reviews?.length > 0) strengths.push('Customer review insights available');
  else limitations.push('Limited customer feedback data');
  
  if (website) strengths.push('Brand messaging and positioning data');
  else limitations.push('Website content analysis incomplete');
  
  if (reddit?.length > 0) strengths.push('Authentic customer voice from social discussions');
  else limitations.push('Social media insights limited');
  
  if (competitors?.length > 0) strengths.push('Competitive landscape analysis');
  else limitations.push('Competitor comparison data missing');

  return {
    score,
    strengths,
    limitations,
    confidence: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
  };
}

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting comprehensive psychological ICP generation for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Validate data quality for comprehensive analysis
    const rawReviews = await getJobData(jobId, 'reviews');
    const websiteData = await getJobData(jobId, 'website');
    const redditData = await getJobData(jobId, 'reddit');
    const competitors = await getJobData(jobId, 'amazon_competitors');
    
    const dataQuality = validateDataQuality(rawReviews, websiteData, redditData, competitors);

    await updateJobStatus(jobId, 'processing');

    // Generate comprehensive psychological profile
    const personaProfile = await generateComprehensivePersona({
      jobId,
      websiteUrl,
      targetKeywords,
      rawReviews,
      websiteData,
      redditData,
      competitors,
      dataQuality
    });

    await updateJobStatus(jobId, 'processing');

    // Save the comprehensive persona analysis
    await saveJobData(jobId, 'persona_profile', personaProfile);

    await updateJobStatus(jobId, 'completed');

    console.log(`Comprehensive psychological ICP generation completed for job ${jobId}`);

    return NextResponse.json({
      success: true,
      message: 'Comprehensive psychological ICP generation completed',
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

async function generateComprehensivePersona(data: any) {
  const prompt = `Generate a comprehensive psychological customer persona based on the following data:

Website URL: ${data.websiteUrl}
Target Keywords: ${data.targetKeywords}
Data Quality: ${data.dataQuality.confidence} confidence (${data.dataQuality.score}% complete)

Available Data Sources:
- Customer Reviews: ${data.rawReviews?.length || 0} reviews
- Website Content: ${data.websiteData ? 'Available' : 'Limited'}
- Social Discussions: ${data.redditData?.length || 0} discussions
- Competitor Analysis: ${data.competitors ? 'Available' : 'Limited'}

Create a detailed psychological profile including:
1. Demographics and psychographics
2. Behavioral patterns and motivations
3. Decision-making triggers
4. Pain points and desires
5. Communication preferences
6. Brand relationship dynamics

Ensure all insights are evidence-based and cite specific data sources.`;

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
            content: 'You are an expert customer research analyst specializing in psychological profiling and behavioral economics. Generate detailed, evidence-based customer personas with specific insights backed by data.'
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
      dataQuality: data.dataQuality,
      sources: {
        reviews: data.rawReviews?.length || 0,
        website: data.websiteData ? 'analyzed' : 'limited',
        social: data.redditData?.length || 0,
        competitors: data.competitors ? 'analyzed' : 'limited'
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        confidence: data.dataQuality.confidence
      }
    };

  } catch (error) {
    console.error('Error generating persona:', error);
    throw error;
  }
}
