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

  const prompt = `You are analyzing a business that sells: ${data.targetKeywords}

ACTUAL WEBSITE CONTENT TO USE:
"${websiteContent}"

ACTUAL VALUE PROPOSITIONS FOUND:
${valueProps.map(vp => `- ${vp}`).join('\n')}

ACTUAL FEATURES FOUND:
${features.map(f => `- ${f}`).join('\n')}

ACTUAL BENEFITS FOUND:
${benefits.map(b => `- ${b}`).join('\n')}

ACTUAL KEYWORDS FOUND:
${keywords.join(', ')}

CRITICAL INSTRUCTIONS:
1. You MUST mention the specific keywords: ${data.targetKeywords}
2. You MUST reference the actual value propositions listed above
3. You MUST mention the specific features listed above
4. You MUST reference the actual benefits listed above
5. DO NOT use generic business language
6. DO NOT say "health-conscious consumers" - be specific to this product
7. MUST mention the actual product category multiple times

Create a customer persona that:

**WHO THEY ARE:**
- Specific demographics for people who buy ${data.targetKeywords}
- Include age, income, lifestyle that relates to ${data.targetKeywords}
- Mention why they specifically need ${data.targetKeywords}

**THEIR SPECIFIC PROBLEMS:**
- Pain points that ${data.targetKeywords} solves
- Reference the actual benefits: ${benefits.join(', ')}
- Problems they have that led them to search for ${data.targetKeywords}

**WHY THEY BUY THIS SPECIFIC PRODUCT:**
- Reference these exact value propositions: ${valueProps.join(', ')}
- Mention these specific features: ${features.join(', ')}
- Connect to these actual benefits: ${benefits.join(', ')}

**WHAT THEY CARE ABOUT:**
- Values related to ${data.targetKeywords}
- Concerns specific to ${data.targetKeywords} purchase decisions
- Information they seek about ${data.targetKeywords}

EXAMPLE OF WHAT TO INCLUDE:
"Sarah is interested in ${data.targetKeywords} because she values ${benefits[0] || 'better sleep'}. She was attracted to this product because of ${valueProps[0] || 'premium quality'} and specifically looks for ${features[0] || 'organic materials'} when shopping for ${data.targetKeywords}."

WRITE THE PERSONA NOW - MUST MENTION "${data.targetKeywords}" AT LEAST 5 TIMES:`;

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
            content: `You are a persona generator that MUST create specific personas based on actual product data. You MUST use the exact keywords, features, and benefits provided. DO NOT CREATE GENERIC BUSINESS PERSONAS. Focus specifically on the product category mentioned.`
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
