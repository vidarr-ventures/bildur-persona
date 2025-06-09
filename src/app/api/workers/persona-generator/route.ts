import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { getJobData, saveJobData } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { jobId, websiteUrl, targetKeywords, websiteData, redditData, reviewsData, competitorsData } = await request.json();

    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    console.log(`Starting SPECIFIC persona generation for job ${jobId}`);
    console.log('Website data received:', websiteData);
    
    await updateJobStatus(jobId, 'processing');
    
    // Use provided data OR fallback to database
    const rawReviews = reviewsData || await getJobData(jobId, 'reviews');
    const websiteDataFinal = websiteData || await getJobData(jobId, 'website');
    const redditDataFinal = redditData || await getJobData(jobId, 'reddit'); 
    const competitors = competitorsData || await getJobData(jobId, 'amazon_competitors');
    
    // Generate SPECIFIC persona
    const personaProfile = await generateSpecificPersona({
      jobId,
      websiteUrl,
      targetKeywords,
      websiteData: websiteDataFinal,
      redditData: redditDataFinal,
      rawReviews,
      competitors
    });

    await saveJobData(jobId, 'persona_profile', personaProfile);
    await updateJobStatus(jobId, 'completed');

    console.log(`SPECIFIC persona generation completed for job ${jobId}`);

    return NextResponse.json({
      success: true,
      message: 'Specific persona generation completed',
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

async function generateSpecificPersona(data: any) {
  // Extract the actual content
  const websiteContent = data.websiteData?.content || '';
  const valueProps = data.websiteData?.valuePropositions || [];
  const features = data.websiteData?.features || [];
  const benefits = data.websiteData?.benefits || [];
  const keywords = data.websiteData?.keywords || [];
  
  console.log('Creating persona with data:', {
    contentLength: websiteContent.length,
    valuePropsCount: valueProps.length,
    featuresCount: features.length,
    benefitsCount: benefits.length
  });

  const prompt = `STOP. You are creating a customer persona for someone who buys GROUNDING SHEETS and EARTHING products.

This is NOT a software product. This is NOT a tech product. This is NOT a business service.

GROUNDING SHEETS are bedding products that connect people to the earth's energy while they sleep.

REAL WEBSITE DATA FROM GROUNDLUXE.COM:
Title: "${data.websiteData?.title || 'GroundLuxe Grounding Sheets'}"
Content: "${websiteContent.substring(0, 1000)}"

VALUE PROPOSITIONS FROM THE ACTUAL WEBSITE:
${valueProps.map((vp: string) => `- ${vp}`).join('\n')}

FEATURES FROM THE ACTUAL WEBSITE:
${features.map((f: string) => `- ${f}`).join('\n')}

BENEFITS FROM THE ACTUAL WEBSITE:
${benefits.map((b: string) => `- ${b}`).join('\n')}

MANDATORY REQUIREMENTS - FAILURE TO FOLLOW = REWRITE:
1. Write "GROUNDING SHEETS" at least 8 times in the persona
2. Write "EARTHING" at least 4 times
3. Reference sleep, health, wellness, natural healing
4. Mention conductive materials, silver, cotton if found in data
5. NO tech language, NO software terms, NO business jargon
6. Focus on SLEEP PROBLEMS, HEALTH ISSUES, WELLNESS GOALS

CREATE PERSONA FOR: Person who buys grounding sheets to improve their sleep and health

**CUSTOMER PROFILE:**
Name: [Create a realistic name]
Age: [Age range for people interested in natural health/sleep solutions]
Problem: [Specific sleep or health issues that grounding sheets address]
Why grounding sheets: [Reference actual benefits from the website data above]
What they value: [Reference actual value propositions from website data above]
Shopping behavior: [How they research grounding sheets and earthing products]

EXAMPLE STRUCTURE:
"Meet Jennifer, 42, who suffers from poor sleep quality and discovered grounding sheets as a natural solution. She was drawn to GroundLuxe's grounding sheets because of [actual value prop from data]. She specifically looks for grounding sheets with [actual features from data]. Jennifer values grounding sheets that provide [actual benefits from data]."

WRITE THE COMPLETE PERSONA NOW - REMEMBER THIS IS ABOUT GROUNDING SHEETS FOR SLEEP AND HEALTH:`;

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
            content: `You are creating a customer persona for GROUNDING SHEETS and EARTHING products. These are bedding products for sleep and health, NOT technology or business products. You MUST create personas specific to people who buy grounding sheets for better sleep and natural health. DO NOT create generic business personas. Focus on sleep problems, health issues, and natural wellness solutions.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const result = await response.json();
    const analysis = result.choices[0]?.message?.content || 'No analysis generated';

    // Verify the persona mentions the target keywords
    const mentionsKeywords = data.targetKeywords.toLowerCase().split(',').some((keyword: string) => 
      analysis.toLowerCase().includes(keyword.trim().toLowerCase())
    );

    console.log('Generated persona mentions target keywords:', mentionsKeywords);
    console.log('Persona preview:', analysis.substring(0, 200));

    return {
      persona: analysis,
      dataUsed: {
        websiteContent: websiteContent.length > 0,
        valuePropositions: valueProps.length,
        features: features.length,  
        benefits: benefits.length,
        keywords: keywords.length,
        mentionsTargetKeywords: mentionsKeywords
      },
      sources: {
        website: data.websiteData ? 'analyzed' : 'not available',
        reviews: data.rawReviews ? 'analyzed' : 'not available', 
        social: data.redditData ? 'analyzed' : 'not available',
        competitors: data.competitors ? 'analyzed' : 'not available'
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId: data.jobId,
        targetKeywords: data.targetKeywords,
        websiteUrl: data.websiteUrl
      }
    };

  } catch (error) {
    console.error('Error generating persona:', error);
    throw error;
  }
}
