import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData } from '@/lib/db';

interface DataQuality {
  score: number;
  strengths: string[];
  limitations: string[];
  confidence: 'high' | 'medium' | 'low';
}

function validateDataQuality(reviews: any, website: any, reddit: any, competitors: any): DataQuality {
  let score = 0;
  const strengths = [];
  const limitations = [];
  
  // Check reviews data
  if (reviews && (reviews.length > 0 || reviews.analysis)) {
    score += 25;
    strengths.push('Customer review insights available');
  } else {
    limitations.push('Limited customer feedback data');
  }
  
  // Check website data  
  if (website && (website.content || website.valuePropositions)) {
    score += 25;
    strengths.push('Brand messaging and positioning data');
  } else {
    limitations.push('Website content analysis incomplete');
  }
  
  // Check reddit data
  if (reddit && (reddit.length > 0 || reddit.threads)) {
    score += 25;
    strengths.push('Authentic customer voice from social discussions');
  } else {
    limitations.push('Social media insights limited');
  }
  
  // Check competitors data
  if (competitors && (competitors.length > 0 || competitors.competitors)) {
    score += 25;
    strengths.push('Competitive landscape analysis');
  } else {
    limitations.push('Competitor comparison data missing');
  }

  return {
    score,
    strengths,
    limitations,
    confidence: score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
  };
}

export async function POST(request: NextRequest) {
  try {
    // Accept both direct data and job ID for database lookup
    const { jobId, websiteUrl, targetKeywords, websiteData, redditData, reviewsData, competitorsData } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting comprehensive psychological ICP generation for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing');
    
    // Use provided data OR fallback to database
    const rawReviews = reviewsData || await getJobData(jobId, 'reviews');
    const websiteDataFinal = websiteData || await getJobData(jobId, 'website');
    const redditDataFinal = redditData || await getJobData(jobId, 'reddit'); 
    const competitors = competitorsData || await getJobData(jobId, 'amazon_competitors');
    
    console.log('Data sources:', {
      reviews: rawReviews ? 'provided/found' : 'missing',
      website: websiteDataFinal ? 'provided/found' : 'missing',
      reddit: redditDataFinal ? 'provided/found' : 'missing',
      competitors: competitors ? 'provided/found' : 'missing'
    });
    
    const dataQuality = validateDataQuality(rawReviews, websiteDataFinal, redditDataFinal, competitors);

    await updateJobStatus(jobId, 'processing');

    // Generate comprehensive psychological profile
    const personaProfile = await generateComprehensivePersona({
      jobId,
      websiteUrl,
      targetKeywords,
      rawReviews,
      websiteData: websiteDataFinal,
      redditData: redditDataFinal,
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
  // Build detailed data context for AI
  let dataContext = `Website URL: ${data.websiteUrl}\nTarget Keywords: ${data.targetKeywords}\n\n`;
  
  // Add website data context
  if (data.websiteData) {
    dataContext += `WEBSITE ANALYSIS:\n`;
    dataContext += `Content: ${data.websiteData.content || 'No content available'}\n`;
    
    if (data.websiteData.valuePropositions && data.websiteData.valuePropositions.length > 0) {
      dataContext += `Value Propositions: ${data.websiteData.valuePropositions.join(', ')}\n`;
    }
    
    if (data.websiteData.features && data.websiteData.features.length > 0) {
      dataContext += `Key Features: ${data.websiteData.features.join(', ')}\n`;
    }
    
    if (data.websiteData.benefits && data.websiteData.benefits.length > 0) {
      dataContext += `Benefits: ${data.websiteData.benefits.join(', ')}\n`;
    }
    
    if (data.websiteData.keywords && data.websiteData.keywords.length > 0) {
      dataContext += `Keywords Found: ${data.websiteData.keywords.join(', ')}\n`;
    }
    dataContext += `\n`;
  }
  
  // Add reviews data context
  if (data.rawReviews) {
    dataContext += `CUSTOMER REVIEWS:\n`;
    if (data.rawReviews.analysis) {
      dataContext += `Review Analysis: ${JSON.stringify(data.rawReviews.analysis, null, 2)}\n`;
    } else if (Array.isArray(data.rawReviews) && data.rawReviews.length > 0) {
      dataContext += `Found ${data.rawReviews.length} customer reviews\n`;
    } else {
      dataContext += `No customer reviews available\n`;
    }
    dataContext += `\n`;
  }
  
  // Add reddit data context
  if (data.redditData) {
    dataContext += `SOCIAL MEDIA DISCUSSIONS:\n`;
    if (data.redditData.threads && data.redditData.threads.length > 0) {
      dataContext += `Found ${data.redditData.threads.length} Reddit discussions\n`;
    } else if (Array.isArray(data.redditData) && data.redditData.length > 0) {
      dataContext += `Found ${data.redditData.length} social discussions\n`;
    } else {
      dataContext += `No social media discussions available\n`;
    }
    dataContext += `\n`;
  }
  
  // Add competitor data context
  if (data.competitors) {
    dataContext += `COMPETITIVE ANALYSIS:\n`;
    if (data.competitors.competitors && data.competitors.competitors.length > 0) {
      dataContext += `Found ${data.competitors.competitors.length} competitors\n`;
    } else if (Array.isArray(data.competitors) && data.competitors.length > 0) {
      dataContext += `Found ${data.competitors.length} competitors\n`;
    } else {
      dataContext += `No competitor data available\n`;
    }
    dataContext += `\n`;
  }
  
  dataContext += `Data Quality: ${data.dataQuality.confidence} confidence (${data.dataQuality.score}% complete)\n`;
  dataContext += `Strengths: ${data.dataQuality.strengths.join(', ')}\n`;
  dataContext += `Limitations: ${data.dataQuality.limitations.join(', ')}\n\n`;

  const prompt = `Based on the detailed data analysis below, create a comprehensive customer persona profile:

${dataContext}

Generate a detailed psychological customer profile that includes:

1. **Demographics & Psychographics**
   - Age, gender, income, education, lifestyle
   - Values, beliefs, personality traits
   - Motivations and aspirations

2. **Behavioral Patterns**  
   - Shopping behavior and decision-making process
   - Online activity and content consumption
   - Brand interaction preferences

3. **Pain Points & Challenges**
   - Specific problems they're trying to solve
   - Frustrations with current solutions
   - Barriers to purchase

4. **Goals & Desires**
   - What they ultimately want to achieve
   - Success metrics and outcomes
   - Emotional drivers

5. **Communication Style**
   - Preferred channels and messaging
   - Language and tone preferences
   - Information processing style

6. **Decision Journey**
   - How they research and evaluate options
   - Key decision factors and triggers
   - Influencers and information sources

**IMPORTANT:** Base ALL insights on the specific data provided above. Reference actual features, benefits, and keywords from the website content. If limited data is available, clearly state this and focus on what can be reasonably inferred from the available information.

Create a specific, actionable persona that reflects the actual product/service being analyzed.`;

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
            content: 'You are an expert customer research analyst specializing in psychological profiling and behavioral economics. Generate detailed, evidence-based customer personas using ONLY the specific data provided. Do not make generic assumptions - base everything on the actual website content, features, and benefits mentioned in the data.'
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
        reviews: data.rawReviews ? 'analyzed' : 'not available',
        website: data.websiteData ? 'analyzed' : 'not available',
        social: data.redditData ? 'analyzed' : 'not available',
        competitors: data.competitors ? 'analyzed' : 'not available'
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        confidence: data.dataQuality.confidence,
        dataUsed: {
          websiteContent: data.websiteData?.content ? data.websiteData.content.length : 0,
          valuePropositions: data.websiteData?.valuePropositions?.length || 0,
          features: data.websiteData?.features?.length || 0,
          benefits: data.websiteData?.benefits?.length || 0
        }
      }
    };

  } catch (error) {
    console.error('Error generating persona:', error);
    throw error;
  }
}
