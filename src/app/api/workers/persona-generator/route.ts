import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PERSONA_PROMPT = `# Ultimate Psychological ICP Development Prompt

## Overview
Create a comprehensive, psychologically nuanced Ideal Customer Profile (ICP) based on the collected research data from Amazon competitor analysis, review collection, and market research. This ICP should go beyond traditional demographic data to deliver deep psychological insights about your target customer's mindstates, motivations, decision-making processes, life event triggers, and generational characteristics.

## Data Integration Guidelines
Use the following collected data to inform your analysis:
* Amazon Competitor Products: Product titles, pricing, ratings, review counts, competitive landscape
* Customer Reviews: Actual review text from user's product and competitor products across multiple sources
* Review Insights: Rating distributions, source breakdown, verified purchase rates
* Target Keywords: User-specified keywords that define the product category
* Product Context: User's Amazon product URL and primary website for context

Evidence Requirements:
* Quote actual customer review text to support behavioral insights
* Reference specific competitor positioning to identify market gaps
* Use review language patterns to understand authentic customer voice
* Cite rating trends and sentiment patterns from collected data

## Framework Integration
This prompt integrates five powerful frameworks:
1. The ICP Research & Refinement Process
2. The Mindstate Behavioral Model
3. Predictably Irrational Behavioral Economics
4. The RMBC Research Method
5. Generational Marketing Strategy

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
Based on the predominant generation of your target customer, analyze their specific traits:

**Baby Boomers (Born ~1946-1964)**
If your target customers are primarily Baby Boomers, consider:
* Strong brand loyalty when trust is established
* Preference for traditional marketing channels (TV, print, direct mail)
* Emphasis on quality, reliability, and practical value over trends
* Gradual adoption of digital platforms (primarily Facebook)
* Desire for straightforward, no-nonsense marketing
* Strong positive response to direct mail promotions
* Low trust in social media influencers
* Appreciation for loyalty programs and coupons

**Generation X (Born ~1965-1980)**
If your target customers are primarily Gen X, consider:
* Hybrid media consumption (mix of traditional and digital)
* Strong research orientation before purchasing
* High brand loyalty once earned, but pragmatic not blind
* Quality and value-seeking behavior (willing to pay more for better quality)
* Active on major social platforms, especially Facebook
* Email marketing effectiveness
* Lower ad aversion compared to younger generations
* Preference for authenticity and straight talk over hype

**Millennials (Born ~1981-1996)**
If your target customers are primarily Millennials, consider:
* Digital-first approach with heavy smartphone usage
* Strong social media engagement across multiple platforms
* Desire for personalized experiences and convenience
* Expectation for brand values alignment and transparency
* High responsiveness to influencer marketing
* Preference for mobile-optimized experiences
* Emphasis on experiences over things
* Strong loyalty when rewarded (responsive to loyalty programs)

**Generation Z (Born ~1997-2010)**
If your target customers are primarily Gen Z, consider:
* Digital natives with preference for visual, fast-paced content
* Heavy use of TikTok, Instagram, and YouTube
* Low inherent brand loyalty and high openness to new brands
* Strong demand for authenticity and social responsibility
* Preference for relatability over polish in marketing
* Integration of online and offline ("phygital") experiences
* Influence of peer recommendations and micro-influencers
* Need for interactive and participatory brand experiences

### Psychographic Deep Dive
Go beyond surface-level information using review analysis to understand their inner world:

**Core Attitudes and Values**
* Religious, political, social, and economic attitudes that influence decisions
* Risk tolerance spectrum (conservative vs. adventurous)
* Key values that drive decisions (e.g., sustainability, tradition, innovation)
* Life priorities and how they allocate resources (time, money, attention)
* What makes them feel pride versus shame
* Generation-specific values and expectations from brands

**Hopes, Dreams, and Fears**
* Primary aspirations and goals (personal and professional)
* Definition of success in their own terms
* Deep-seated fears and anxieties revealed in reviews
* Specific worries related to your product/service area
* Emotional drivers behind their purchasing decisions
* What keeps them up at night
* Generational influences on long-term goals and life milestones

**Perceived Obstacles & Outside Forces**
* External forces they believe are holding them back
* Systemic barriers they perceive (e.g., "the system is rigged")
* Personal limitations they acknowledge
* Self-narratives about why they haven't solved their problem yet
* Outside forces they blame for their condition or situation
* How they explain their own successes and failures

## Section 2: Behavioral Psychology Analysis

### Goal Assessment
Identify both functional and higher-order goals based on review analysis:

**Functional Goals:** What specific practical outcomes do they want to achieve?
* Daily tasks they need to accomplish
* Specific problems they're trying to solve
* Practical needs they want to meet

**Higher-Order Goals:** What deeper emotional outcomes are they seeking?
* How do they want to feel about themselves?
* How do they want others to perceive them?
* What identity are they trying to reinforce or achieve?
* What story are they trying to tell themselves?

### Motivation Analysis
Identify the primary psychological motivation(s) driving their behavior from these nine core human motivations:
1. **Achievement:** Desire to feel successful, victorious, and to overcome obstacles
2. **Autonomy:** Desire to feel unique, independent, and self-determined
3. **Belonging:** Desire to feel aligned, accepted, and connected with others
4. **Competence:** Desire to feel capable, qualified, prepared, and skilled
5. **Empowerment:** Desire to feel authorized and equipped to act on choices
6. **Engagement:** Desire to feel captivated, excited, and interested
7. **Esteem:** Desire to feel approved, respected, and admired by others
8. **Nurturance:** Desire to feel appreciated, loved, and to care for others
9. **Security:** Desire to feel safe and protected from threats

### Cognitive Heuristics & Predictable Irrationalities
Identify 3-5 key mental shortcuts and predictable irrationalities they exhibit based on review patterns:
* **Price Anchoring:** How initial price points influence their valuations
* **Social Proof:** How they rely on other customers' experiences and ratings
* **Loss Aversion:** Overweighting potential negatives vs. positives
* **Zero-Price Effect:** Irrationally overvaluing "free" options
* **Endowment Effect:** Overvaluing things they already own
* **Choice Overload:** Decision paralysis when faced with too many options

For each pattern, explain:
* How it influences their decision-making in your category
* Evidence from reviews showing this behavior
* How competitors currently exploit this pattern
* Opportunities to ethically leverage this insight

## Section 3: Competitive Analysis Integration

### Current Solutions Landscape
Analyze how your target customer currently addresses their needs based on competitor research:

**Direct Competitors:** What similar products/services do they currently use?
* Market leaders and their positioning
* Emerging alternatives gaining traction
* Features and benefits most valued by customers (from reviews)
* Pricing strategies and customer perception

**Indirect Alternatives:** What different approaches do they use?
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

**Positive Aspects:** What do they consistently praise about current options?
* Features they love and wouldn't give up
* Benefits they actually experience (vs. what's promised)
* Emotional satisfactions derived from current solutions

**Pain Points:** What frustrates them about current options?
* Common complaints across multiple solutions
* Deal-breakers that cause them to abandon solutions
* Unmet needs not addressed by any current option
* Misalignments between promises and experiences

Include direct voice-of-customer quotes from collected reviews that exemplify these sentiments.

## Section 4: Life-Event Triggers & Transition Points

### Life Event Analysis
Identify key life transitions that might trigger interest in your product/service:

**Major Life Milestones:** Which specific transitions create need for your offering?
* Marriage, divorce, childbirth, parenthood
* Relocation, home buying/selling
* Career changes, retirement
* Health events or diagnoses
* Education milestones

**Behavioral Changes During Transitions:** How do habits shift during these events?
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

**Awareness:** How do they first recognize they have a need?
* Information sources they consult initially
* How life events create awareness of new needs
* Key questions they have at this stage

**Consideration:** How do they explore and evaluate options?
* Research behaviors (depth, channels, time invested)
* Decision criteria they prioritize based on reviews
* Influence of emotional states on consideration

**Decision:** What factors ultimately drive their choice?
* Final decision triggers evident in review patterns
* Price sensitivity and value perception
* Brand trust factors mentioned in reviews

**Usage:** How do they implement and experience the solution?
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
If review analysis reveals a distinct secondary customer type, provide:
* Similar structure as primary persona
* Key differences from primary persona
* Percentage split of customer base

### Strategic Behavioral Implications
Extract key insights for business strategy:

**Product Development:**
* How should features be designed based on review feedback?
* What choice architecture will lead to optimal decisions?
* Which product aspects matter most during specific life events?

**Pricing Strategy:**
* What price anchors should you establish?
* How might you use competitor pricing as reference points?
* When should you employ bundling vs. unbundling?

**Marketing Messaging:**
* What benefit framing will be most effective (promotion vs. prevention focus)?
* How should you set expectations to enhance experience?
* What language patterns from reviews should you adopt?

**Timing Strategy:**
* When is your solution most needed in their journey?
* Which life events create greatest openness to your offering?
* What is the window of opportunity before habits re-stabilize?

**Channel Strategy:**
* Which channels are most effective during specific life events?
* How does media consumption change during transitions?
* What partnerships could provide earlier access to customers?

**Customer Experience:**
* What moments matter most based on review patterns?
* How can you address common pain points mentioned in reviews?
* What support might they need during different life stages?

**Competitive Positioning:**
* How can you differentiate from alternatives based on competitor analysis?
* What messaging gaps exist in the current market?
* How can you become the preferred choice in your category?

### Life-Event Activation Plan
Develop tactical approach to engage customers during key transitions:

**Detection Methods:** How will you identify customers experiencing relevant life events?
**Timing Framework:** When will you engage at each stage of the life event?
**Personalization Approach:** How will you tailor communications?
**Cross-Sell/Upsell Opportunities:** What related needs emerge from life events?

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

## Output Format Requirements
Deliver a structured report with clear sections and actionable insights. Use actual quotes from collected reviews to support findings. Ensure all recommendations are grounded in the collected data rather than generic assumptions.

**Word Count Target:** 3,000-4,000 words for comprehensive analysis
**Focus:** Actionable insights that directly inform product, marketing, and business strategy decisions
**Evidence:** Root all insights in the actual collected data from reviews and competitive analysis`;

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { rawReviews, collectionSummary, competitors, userProduct, targetKeywords } = payload;
    
    console.log(`Starting persona generation for job ${jobId}`);
    
    // Update job status
    await updateJobStatus(jobId, 'processing', 85, undefined, undefined);
    
    // Prepare data for OpenAI
    const dataContext = prepareDataContext(rawReviews, collectionSummary, competitors, userProduct, targetKeywords);
    
    console.log(`Generating personas with ${rawReviews?.length || 0} reviews and ${competitors?.length || 0} competitors`);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 90, undefined, undefined);
    
    // Generate persona with OpenAI
    const personaReport = await generatePersonaWithOpenAI(dataContext);
    
    // Store the complete report
    await storePersonaReport(jobId, personaReport);
    
    // Update progress
    await updateJobStatus(jobId, 'processing', 95, undefined, undefined);
    
    // Generate executive summary for dashboard
    const executiveSummary = extractExecutiveSummary(personaReport);
    
    // Mark job as completed with report URL
    await updateJobStatus(jobId, 'completed', 100, undefined, undefined);
    
    const queue = new JobQueue();
    await queue.markTaskCompleted(jobId, 'persona-generator');
    
    console.log(`Persona generation completed for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Persona generation completed',
      executiveSummary,
      reportGenerated: true
    });

  } catch (error) {
    console.error('Persona generation error:', error);
    
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      undefined, 
      `Persona generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Persona generation failed' },
      { status: 500 }
    );
  }
}

function prepareDataContext(rawReviews: any[], collectionSummary: any, competitors: any[], userProduct: any, targetKeywords: string) {
  // Sample a representative set of reviews for analysis (to stay within token limits)
  const maxReviews = 50;
  const sampleReviews = rawReviews?.slice(0, maxReviews) || [];
  
  return {
    productContext: {
      targetKeywords,
      userProduct: userProduct || {},
      totalReviewsCollected: rawReviews?.length || 0
    },
    competitorAnalysis: {
      competitors: competitors?.slice(0, 10) || [], // Limit to top 10 for context
      competitorCount: competitors?.length || 0
    },
    reviewAnalysis: {
      sampleReviews: sampleReviews.map(review => ({
        source: review.source,
        productTitle: review.productTitle,
        reviewText: review.reviewText,
        rating: review.rating,
        verifiedPurchase: review.verifiedPurchase
      })),
      collectionSummary: collectionSummary || {}
    }
  };
}

async function generatePersonaWithOpenAI(dataContext: any): Promise<string> {
  const systemPrompt = PERSONA_PROMPT;
  
  const userPrompt = `
Based on the following collected data, generate a comprehensive customer persona analysis:

## Product Context
Target Keywords: ${dataContext.productContext.targetKeywords}
Total Reviews Analyzed: ${dataContext.productContext.totalReviewsCollected}

## Competitor Landscape
Number of Competitors Analyzed: ${dataContext.competitorAnalysis.competitorCount}
Key Competitors:
${dataContext.competitorAnalysis.competitors.map((comp: any, index: number) => 
  `${index + 1}. ${comp.title} - ${comp.price} - ${comp.rating}`
).join('\n')}

## Customer Review Analysis
Sample Reviews for Analysis:
${dataContext.reviewAnalysis.sampleReviews.map((review: any, index: number) => 
  `
Review ${index + 1} (${review.source} - ${review.rating}/5 stars):
Product: ${review.productTitle}
Review: "${review.reviewText}"
Verified Purchase: ${review.verifiedPurchase}
`
).join('\n')}

## Collection Summary
${JSON.stringify(dataContext.reviewAnalysis.collectionSummary, null, 2)}

Please analyze this data and generate a comprehensive customer persona report following the framework provided in the system prompt. Focus on extracting insights from the actual review text and competitive landscape data provided.
`;

  try {
    const openai = getOpenAIClient();
const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 4000,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'Error generating persona report';
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw new Error(`OpenAI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function storePersonaReport(jobId: string, personaReport: string) {
  console.log(`Storing persona report for job ${jobId} (${personaReport.length} characters)`);
  
  // TODO: Store the complete report in Vercel Blob or database
  // const blob = await put(`reports/${jobId}-persona.md`, personaReport, {
  //   contentType: 'text/markdown',
  // });
  
  // For now, just log summary
  console.log('Persona report generated successfully');
}

function extractExecutiveSummary(personaReport: string): string {
  // Extract the executive summary section from the full report
  const summaryMatch = personaReport.match(/## Executive Summary[\s\S]*?(.*?)(?=##|$)/);
  
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }
  
  // Fallback: take first paragraph
  const firstParagraph = personaReport.split('\n\n')[0];
  return firstParagraph || 'Comprehensive customer persona analysis completed.';
}
