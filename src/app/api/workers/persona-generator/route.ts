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

    // Send email with persona report
    if (email && personaProfile?.persona) {
      console.log(`Sending persona report email to ${email} for job ${jobId}`);
      try {
        const emailSent = await sendPersonaReport({
          jobId,
          email,
          websiteUrl: websiteUrl || 'Unknown',
          keywords: targetKeywords || 'Not specified',
          personaReport: personaProfile.persona,
          planName: planName || 'Standard Analysis',
          analysisDate: new Date().toLocaleDateString()
        });

        if (emailSent) {
          console.log(`✅ Email sent successfully to ${email} for job ${jobId}`);
          // Mark email as sent in database
          await markPersonaReportSent(jobId);
        } else {
          console.error(`❌ Failed to send email to ${email} for job ${jobId}`);
        }
      } catch (emailError) {
        console.error(`Email sending error for job ${jobId}:`, emailError);
      }
    } else {
      console.warn(`Missing email (${email}) or persona content (${!!personaProfile?.persona}) for job ${jobId} - skipping email`);
    }

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

  const prompt = `Ultimate Psychological ICP Development Prompt

Overview
Create a comprehensive, psychologically nuanced Ideal Customer Profile (ICP) based on the collected research data from Amazon competitor analysis, review collection, and market research. This ICP should go beyond traditional demographic data to deliver deep psychological insights about your target customer's mindstates, motivations, decision-making processes, life event triggers, and generational characteristics.

Target Keywords: ${data.targetKeywords}
Website URL: ${data.websiteUrl}
Amazon Product URL: ${data.amazonUrl || 'Not provided'}

=== COLLECTED DATA SOURCES ===

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

=== ANALYSIS REQUIREMENTS ===

Based on the collected data above, create a comprehensive psychological ICP following this exact structure:

## Section 1: Customer Demographics & Psychographics

### Demographic Profile
Based on the collected reviews, competitor analysis, and product context, infer specific details about who this customer is:
* Age range and generation (e.g., Millennials, Gen X)
* Gender distribution (if relevant from review patterns)
* Geographic location and living environment
* Education level and professional background (inferred from review sophistication)
* Income level and financial stability (based on price sensitivity in reviews)
* Family status and household composition
* Technology adoption profile
* Cultural background and influences

### Generational Analysis
Based on the predominant generation of your target customer, analyze their specific traits and marketing implications.

### Psychographic Deep Dive
Go beyond surface-level information using review analysis to understand their inner world:

#### Core Attitudes and Values
* Religious, political, social, and economic attitudes that influence decisions
* Risk tolerance spectrum (conservative vs. adventurous)
* Key values that drive decisions (e.g., sustainability, tradition, innovation)
* Life priorities and how they allocate resources (time, money, attention)
* What makes them feel pride versus shame
* Generation-specific values and expectations from brands

#### Hopes, Dreams, and Fears
* Primary aspirations and goals (personal and professional)
* Definition of success in their own terms
* Deep-seated fears and anxieties revealed in reviews
* Specific worries related to your product/service area
* Emotional drivers behind their purchasing decisions
* What keeps them up at night
* Generational influences on long-term goals and life milestones

#### Perceived Obstacles & Outside Forces
* External forces they believe are holding them back
* Systemic barriers they perceive (e.g., "the system is rigged")
* Personal limitations they acknowledge
* Self-narratives about why they haven't solved their problem yet
* Outside forces they blame for their condition or situation
* How they explain their own successes and failures

## Section 2: Behavioral Psychology Analysis

### Goal Assessment
Identify both functional and higher-order goals based on review analysis:

#### Functional Goals: What specific practical outcomes do they want to achieve?
* Daily tasks they need to accomplish
* Specific problems they're trying to solve
* Practical needs they want to meet

#### Higher-Order Goals: What deeper emotional outcomes are they seeking?
* How do they want to feel about themselves?
* How do they want others to perceive them?
* What identity are they trying to reinforce or achieve?
* What story are they trying to tell themselves?

### Motivation Analysis
Identify the primary psychological motivation(s) driving their behavior from these nine core human motivations:
1. Achievement: Desire to feel successful, victorious, and to overcome obstacles
2. Autonomy: Desire to feel unique, independent, and self-determined
3. Belonging: Desire to feel aligned, accepted, and connected with others
4. Competence: Desire to feel capable, qualified, prepared, and skilled
5. Empowerment: Desire to feel authorized and equipped to act on choices
6. Engagement: Desire to feel captivated, excited, and interested
7. Esteem: Desire to feel approved, respected, and admired by others
8. Nurturance: Desire to feel appreciated, loved, and to care for others
9. Security: Desire to feel safe and protected from threats

### Cognitive Heuristics & Predictable Irrationalities
Identify 3-5 key mental shortcuts and predictable irrationalities they exhibit based on review patterns:
* Price Anchoring: How initial price points influence their valuations
* Social Proof: How they rely on other customers' experiences and ratings
* Loss Aversion: Overweighting potential negatives vs. positives
* Zero-Price Effect: Irrationally overvaluing "free" options
* Endowment Effect: Overvaluing things they already own
* Choice Overload: Decision paralysis when faced with too many options

For each pattern, explain:
* How it influences their decision-making in your category
* Evidence from reviews showing this behavior
* How competitors currently exploit this pattern
* Opportunities to ethically leverage this insight

## Section 3: Competitive Analysis Integration

### Current Solutions Landscape
Analyze how your target customer currently addresses their needs based on competitor research:

#### Direct Competitors: What similar products/services do they currently use?
* Market leaders and their positioning
* Emerging alternatives gaining traction
* Features and benefits most valued by customers (from reviews)
* Pricing strategies and customer perception

#### Indirect Alternatives: What different approaches do they use?
* Adjacent categories that serve similar needs
* DIY or workaround solutions mentioned in reviews
* Non-consumption options (doing nothing about the problem)

### Competitive Differentiation Opportunities
Based on collected competitor data, identify:
* How competitor customers differ from your ideal target
* Messaging gaps in the current market
* Underserved persona segments
* Pain points competitors aren't addressing
* Language and positioning opportunities
* Price/value positioning gaps

### Solution Experience Analysis
Evaluate how they experience existing solutions based on review analysis:

#### Positive Aspects: What do they consistently praise about current options?
* Features they love and wouldn't give up
* Benefits they actually experience (vs. what's promised)
* Emotional satisfactions derived from current solutions

#### Pain Points: What frustrates them about current options?
* Common complaints across multiple solutions
* Deal-breakers that cause them to abandon solutions
* Unmet needs not addressed by any current option
* Misalignments between promises and experiences

Include direct voice-of-customer quotes from collected reviews that exemplify these sentiments.

## Section 4: Life-Event Triggers & Transition Points

### Life Event Analysis
Identify key life transitions that might trigger interest in your product/service:

#### Major Life Milestones: Which specific transitions create need for your offering?
* Marriage, divorce, childbirth, parenthood
* Relocation, home buying/selling
* Career changes, retirement
* Health events or diagnoses
* Education milestones

#### Behavioral Changes During Transitions: How do habits shift during these events?
* Increased research and information-seeking behaviors
* Greater openness to trying new brands and solutions
* Changes in media consumption and shopping patterns
* Shifts in brand loyalty and price sensitivity

### Trigger Detection Strategy
Develop a plan to identify when customers are entering transition states:
* Data signals that would reveal these life events
* Predictive analytics opportunities
* Ethical considerations for life event marketing
* Permission-based approaches to personalization

## Section 5: Decision Journey Mapping

### Journey Stages
Map their path from awareness to decision:

#### Awareness: How do they first recognize they have a need?
* Information sources they consult initially
* How life events create awareness of new needs
* Key questions they have at this stage

#### Consideration: How do they explore and evaluate options?
* Research behaviors (depth, channels, time invested)
* Decision criteria they prioritize based on reviews
* Influence of emotional states on consideration

#### Decision: What factors ultimately drive their choice?
* Final decision triggers evident in review patterns
* Price sensitivity and value perception
* Brand trust factors mentioned in reviews

#### Usage: How do they implement and experience the solution?
* Onboarding and implementation challenges mentioned in reviews
* Success metrics from their perspective
* Evolving needs as they gain experience

### Influence Map
Document who and what shapes their decisions based on review patterns:
* Professional experts they trust
* Peer influences (friends, colleagues, family)
* Online communities and thought leaders
* Preferred content formats and channels

## Section 6: Generation-Specific Marketing Strategy

Based on your target customer's generational profile, develop tailored marketing approaches:

### Channel Strategy
Determine optimal marketing channels based on generational preferences and review platform usage patterns.

### Messaging Approach
Craft messaging that resonates with generational values and communication styles evident in reviews.

### Loyalty & Engagement Strategy
Develop approaches to foster loyalty based on generational expectations and satisfaction patterns from reviews.

## Section 7: ICP Synthesis & Implementation Strategy

### Executive Summary
Create a 1-paragraph overview of who this customer is and what fundamentally drives them, including their key predictable irrationalities and pivotal life events.

### Primary Persona Development
Develop the main representative persona with:
* A descriptive name that captures their essence
* Age, generation, and key demographics
* A day-in-the-life narrative showing decision-making moments
* Key quotes from actual collected reviews that reflect their mindset
* Critical emotional and functional needs
* Primary decision drivers and cognitive biases they exhibit
* Price sensitivity and reference points they use
* Life events that would make them most receptive to your solution

### Secondary Persona (if data supports it)
If review analysis reveals a distinct secondary customer type, provide similar structure as primary persona.

### Strategic Behavioral Implications
Extract key insights for business strategy:

#### Product Development:
* How should features be designed based on review feedback?
* What choice architecture will lead to optimal decisions?
* Which product aspects matter most during specific life events?

#### Pricing Strategy:
* What price anchors should you establish?
* How might you use competitor pricing as reference points?
* When should you employ bundling vs. unbundling?

#### Marketing Messaging:
* What benefit framing will be most effective (promotion vs. prevention focus)?
* How should you set expectations to enhance experience?
* What language patterns from reviews should you adopt?

#### Timing Strategy:
* When is your solution most needed in their journey?
* Which life events create greatest openness to your offering?
* What is the window of opportunity before habits re-stabilize?

#### Channel Strategy:
* Which channels are most effective during specific life events?
* How does media consumption change during transitions?
* What partnerships could provide earlier access to customers?

#### Customer Experience:
* What moments matter most based on review patterns?
* How can you address common pain points mentioned in reviews?
* What support might they need during different life stages?

#### Competitive Positioning:
* How can you differentiate from alternatives based on competitor analysis?
* What messaging gaps exist in the current market?
* How can you become the preferred choice in your category?

### Life-Event Activation Plan
Develop tactical approach to engage customers during key transitions:
* Detection Methods: How will you identify customers experiencing relevant life events?
* Timing Framework: When will you engage at each stage of the life event?
* Personalization Approach: How will you tailor communications?
* Cross-Sell/Upsell Opportunities: What related needs emerge from life events?

## Bonus Section: Brand Identity Recommendations

### Color Palette Recommendation
Based on the persona analysis and competitive differentiation needs, suggest a color palette for the product website that would:
* Appeal specifically to the identified persona's psychological profile
* Reflect their generational preferences and values
* Stand out from the competitor color schemes identified in research
* Support the recommended messaging approach

Include:
* Primary colors (2-3 colors)
* Secondary colors (2-3 colors)
* One color for call to action buttons that is roughly opposite of the other colors on the color wheel so it stands out, but still a tone of that color that fits the overall palette
* Psychological reasoning for each color choice
* How this palette differentiates from competitors

### Brand Voice Recommendation
Based on the persona analysis, suggest a brand voice that would resonate with this customer:
* Tone characteristics (professional, friendly, authoritative, etc.)
* Language style (formal, conversational, technical, simple)
* Communication personality traits
* Key phrases and language patterns to adopt from review analysis
* Words and phrases to avoid
* How this voice differentiates from competitor messaging

Include specific examples of how this voice would sound in:
* Website headlines
* Product descriptions
* Email communications
* Social media posts
* Customer service interactions

### Key Customer Quotes
Using all the review data ONLY from the collected data, and considering the buying motivations of the persona, extract 10 key quotes that are most likely to deeply resonate with potential customers if used in online advertising. Display each quote with attribution to make them easy to export.

IMPORTANT: Ground every insight in the actual customer data provided. Use specific quotes, emotions, and behaviors from the real reviews and discussions above. Focus on actionable insights that directly inform product, marketing, and business strategy decisions.

Generate a comprehensive 3,000-4,000 word psychological ICP analysis:`;

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
            content: 'You are an expert behavioral psychology researcher and customer research analyst specializing in comprehensive Ideal Customer Profile (ICP) development. You integrate psychological frameworks, behavioral economics, generational marketing strategies, and deep customer insights to create actionable business intelligence. You always ground your analysis in actual customer data and provide specific, evidence-based recommendations for product, marketing, and business strategy decisions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
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
