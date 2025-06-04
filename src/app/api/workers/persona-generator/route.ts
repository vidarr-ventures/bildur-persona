import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';
import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { 
      rawReviews, 
      collectionSummary, 
      competitors, 
      userProduct, 
      targetKeywords,
      websiteData,
      websiteInsights,
      redditData,
      redditInsights 
    } = payload;
    
    console.log(`Starting comprehensive psychological ICP generation for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing', 85, undefined, undefined);
    
    // Validate data quality for comprehensive analysis
    const dataQuality = validateDataQuality(rawReviews, websiteData, redditData, competitors);
    
    console.log(`Generating psychological ICP with:
      - ${rawReviews?.length || 0} reviews
      - ${competitors?.length || 0} competitors  
      - ${websiteData?.length || 0} website pages
      - ${redditData?.length || 0} Reddit posts
      - Data quality: ${dataQuality.score}/10`);
    
    await updateJobStatus(jobId, 'processing', 90, undefined, undefined);
    
    // Generate comprehensive psychological ICP report
    const personaReport = await generatePsychologicalICPReport({
      targetKeywords,
      competitors,
      rawReviews,
      websiteData,
      websiteInsights,
      redditData,
      redditInsights,
      userProduct,
      dataQuality
    });
    
    await updateJobStatus(jobId, 'processing', 95, undefined, undefined);
    
    const executiveSummary = `Comprehensive psychological ICP analysis completed for ${targetKeywords}. Deep psychological profiling based on ${rawReviews?.length || 0} customer reviews, ${websiteData?.length || 0} website pages, ${redditData?.length || 0} Reddit discussions, and ${competitors?.length || 0} competitor products. Analysis includes behavioral economics, generational insights, life-event triggers, and strategic recommendations. Data quality: ${dataQuality.score}/10.`;
    
    await updateJobStatus(jobId, 'completed', 100, undefined, undefined);
    
    const queue = new JobQueue();
    await queue.markTaskCompleted(jobId, 'persona-generator');
    
    console.log(`Psychological ICP generation completed for job ${jobId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Comprehensive psychological ICP analysis completed',
      executiveSummary,
      reportGenerated: true,
      dataQuality: dataQuality.score,
      analysisDepth: 'comprehensive_psychological_profile'
    });

  } catch (error) {
    console.error('Psychological ICP generation error:', error);
    
    await updateJobStatus(
      jobId, 
      'failed', 
      0, 
      undefined, 
      `Psychological ICP generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    
    return NextResponse.json(
      { error: 'Psychological ICP generation failed' },
      { status: 500 }
    );
  }
}

function validateDataQuality(rawReviews: any[], websiteData: any[], redditData: any[], competitors: any[]) {
  const missing = [];
  let score = 0;
  
  // Check each data source for comprehensive analysis
  if (!rawReviews || rawReviews.length === 0) {
    missing.push('customer reviews');
  } else {
    score += Math.min(rawReviews.length / 50, 3); // Max 3 points for reviews
  }
  
  if (!websiteData || websiteData.length === 0) {
    missing.push('website content');
  } else {
    score += Math.min(websiteData.length / 5, 2); // Max 2 points for website pages
  }
  
  if (!redditData || redditData.length === 0) {
    missing.push('Reddit discussions');
  } else {
    score += Math.min(redditData.length / 20, 2); // Max 2 points for Reddit data
  }
  
  if (!competitors || competitors.length === 0) {
    missing.push('competitor data');
  } else {
    score += Math.min(competitors.length / 5, 3); // Max 3 points for competitors
  }
  
  return {
    score: Math.round(score),
    insufficient: missing.length > 2,
    missing,
    hasWebsite: websiteData && websiteData.length > 0,
    hasReviews: rawReviews && rawReviews.length > 0,
    hasReddit: redditData && redditData.length > 0,
    hasCompetitors: competitors && competitors.length > 0,
    canDoComprehensiveAnalysis: score >= 6
  };
}

async function generatePsychologicalICPReport(data: {
  targetKeywords: string;
  competitors: any[];
  rawReviews: any[];
  websiteData: any[];
  websiteInsights: any;
  redditData: any[];
  redditInsights: any;
  userProduct: string;
  dataQuality: any;
}): Promise<string> {
  try {
    const openai = getOpenAIClient();
    
    // Prepare comprehensive structured data for analysis
    const structuredData = prepareComprehensiveDataAnalysis(data);
    
    const prompt = `You are an expert customer research analyst specializing in psychological customer profiling and behavioral economics. Create a comprehensive, psychologically nuanced Ideal Customer Profile (ICP) based ONLY on the provided research data.

CRITICAL REQUIREMENTS:
- Base ALL conclusions on the provided data - never make assumptions
- Quote actual customer language from reviews and Reddit discussions
- Cite specific data sources for each insight [Source: Website About Page], [Source: Reddit r/audiophile], [Source: Amazon Review]
- If data is insufficient for a conclusion, state "Insufficient data available for this analysis"
- Use evidence-based language: "Based on review analysis..." or "Reddit discussions reveal..."

${structuredData}

COMPREHENSIVE PSYCHOLOGICAL ICP ANALYSIS REQUIRED:

## Section 1: Customer Demographics & Psychographics

### Demographic Profile
Based ONLY on patterns in the collected data, infer:
- Age range and generation (evidence from review language sophistication, references)
- Geographic patterns (if mentioned in reviews/discussions)
- Education/professional background (inferred from communication style)
- Income indicators (based on price sensitivity patterns in reviews)
- Technology adoption (evident from platform usage and tech comfort)

### Generational Analysis
If demographic patterns suggest a primary generation, analyze their specific traits based on actual behavioral evidence in the data:
- Communication style patterns from reviews/Reddit
- Technology usage patterns evident in data
- Value expressions found in customer language
- Brand loyalty indicators from review patterns

### Psychographic Deep Dive
Using actual customer language from reviews and discussions:

**Core Attitudes and Values:**
- Quote actual value statements from customer content
- Risk tolerance evident in purchase decisions (from reviews)
- Life priorities expressed in customer language

**Hopes, Dreams, and Fears:**
- Aspirations mentioned in reviews/discussions
- Specific fears and anxieties revealed in customer content
- Success definitions in their own words

**Perceived Obstacles:**
- External barriers mentioned by customers
- Self-acknowledged limitations from customer content

## Section 2: Behavioral Psychology Analysis

### Goal Assessment
From review analysis, identify:

**Functional Goals:** (Quote specific customer needs from reviews)
**Higher-Order Goals:** (Emotional outcomes sought, evident in customer language)

### Motivation Analysis
Based on customer language patterns, identify primary motivations from:
1. Achievement 2. Autonomy 3. Belonging 4. Competence 5. Empowerment 
6. Engagement 7. Esteem 8. Nurturance 9. Security

**Evidence Required:** Quote customer language that demonstrates each motivation

### Cognitive Heuristics & Predictable Irrationalities
Identify 3-5 patterns evident in the review data:
- Price anchoring patterns (evidence from review price discussions)
- Social proof reliance (how reviews reference others' experiences)
- Loss aversion (overweighting negatives in reviews)
- Choice overload (decision paralysis indicators)

For each pattern, provide:
- Specific evidence from customer content
- How it influences their decisions (based on review patterns)

## Section 3: Competitive Analysis Integration

### Current Solutions Landscape
Based on competitor data and reviews:
- Direct competitors mentioned by customers
- Features valued by customers (from review praise)
- Pricing perceptions from customer comments

### Solution Experience Analysis
From actual review content:

**Positive Aspects:** (Quote customer praise for current solutions)
**Pain Points:** (Quote customer frustrations and complaints)

## Section 4: Life-Event Triggers & Transition Points

### Life Event Analysis
From customer discussions, identify triggers mentioned:
- Life transitions that prompted purchase (from reviews/Reddit)
- Behavioral changes during these events (evident in customer stories)

### Trigger Detection Strategy
Based on customer behavior patterns in data:
- When customers are most open to new solutions
- Decision journey patterns evident in reviews

## Section 5: Decision Journey Mapping

### Journey Stages
Map their path based on review and discussion analysis:

**Awareness:** How they recognize needs (from customer stories)
**Consideration:** Research behaviors (evident in review depth/questions)
**Decision:** Final decision factors (from review decision explanations)
**Usage:** Implementation experiences (from review outcomes)

### Influence Map
From customer content, document who shapes their decisions:
- Expert sources mentioned in reviews/discussions
- Peer influences referenced by customers
- Online communities they participate in

## Section 6: Generation-Specific Marketing Strategy
Based on identified generational patterns in the data:
- Channel preferences (evident from platform usage)
- Messaging styles that resonate (from successful customer interactions)
- Loyalty patterns (from review history analysis)

## Section 7: ICP Synthesis & Implementation Strategy

### Executive Summary
1-paragraph overview based entirely on data patterns

### Primary Persona Development
- Representative name that captures their essence
- Demographics based on data patterns
- Day-in-the-life narrative using actual customer language
- Key quotes from collected reviews that reflect their mindset
- Decision drivers evident in review patterns
- Price sensitivity from review analysis
- Life events that make them receptive (from customer stories)

### Strategic Behavioral Implications

**Product Development:**
- Feature priorities from review feedback
- Design preferences from customer comments

**Pricing Strategy:**
- Price anchors from customer discussions
- Competitor pricing perceptions from reviews

**Marketing Messaging:**
- Language patterns that resonate (from positive reviews)
- Benefit framing preferences (from customer language)

**Customer Experience:**
- Critical moments from review analysis
- Common pain points to address (from customer complaints)

## Bonus Section: Brand Identity Recommendations

### Color Palette Recommendation
Based on persona analysis and competitive differentiation:
- Primary colors (2-3) with psychological reasoning
- Secondary colors (2-3) based on target preferences
- CTA color that stands out but fits the palette
- How this differentiates from competitors

### Brand Voice Recommendation
Based on successful customer communication patterns:
- Tone characteristics that resonate (from review analysis)
- Language style preferences (formal/casual from customer interactions)
- Key phrases to adopt (from positive customer language)
- Words to avoid (from negative customer reactions)

## Data Limitations & Gaps
Clearly state:
- What information is missing from the dataset
- Gaps that require additional research
- Confidence level for each section based on data quality

WORD COUNT TARGET: 3,000-4,000 words
EVIDENCE REQUIREMENT: Every insight must be supported by specific quotes or data patterns from the collected research
ACCURACY REQUIREMENT: If the data doesn't support a conclusion, acknowledge the limitation rather than making assumptions`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: "You are an expert customer research analyst who creates comprehensive psychological profiles based ONLY on provided evidence. You never make assumptions beyond what the data shows. You always cite sources and acknowledge limitations. You specialize in behavioral economics, generational psychology, and evidence-based customer profiling." 
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 4000,
      temperature: 0.1, // Very low temperature for accuracy
    });

    return completion.choices[0]?.message?.content || 'Comprehensive psychological ICP analysis could not be completed due to API error';
    
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Return comprehensive data-based fallback analysis
    return generateComprehensiveFallbackAnalysis(data);
  }
}

function prepareComprehensiveDataAnalysis(data: {
  targetKeywords: string;
  competitors: any[];
  rawReviews: any[];
  websiteData: any[];
  websiteInsights: any;
  redditData: any[];
  redditInsights: any;
  userProduct: string;
  dataQuality: any;
}): string {
  let analysis = `COMPREHENSIVE DATASET FOR PSYCHOLOGICAL ICP ANALYSIS\n\n`;
  analysis += `TARGET PRODUCT: ${data.userProduct}\n`;
  analysis += `TARGET KEYWORDS: ${data.targetKeywords}\n`;
  analysis += `DATA QUALITY SCORE: ${data.dataQuality.score}/10\n\n`;
  
  // Website Content Analysis - Brand messaging and values
  if (data.websiteData && data.websiteData.length > 0) {
    analysis += `=== WEBSITE CONTENT ANALYSIS (${data.websiteData.length} pages) ===\n`;
    data.websiteData.forEach((page: any, index: number) => {
      analysis += `\nPAGE ${index + 1}: ${page.pageType.toUpperCase()} - ${page.title}\n`;
      analysis += `URL: ${page.url}\n`;
      analysis += `Content: ${page.content.substring(0, 800)}...\n`;
      analysis += `Key Headings: ${page.headings?.slice(0, 5).join(' | ') || 'None'}\n`;
    });
    
    if (data.websiteInsights) {
      analysis += `\n--- WEBSITE INSIGHTS ---\n`;
      analysis += `Brand Messaging: ${data.websiteInsights.brandMessaging?.join(' | ') || 'None identified'}\n`;
      analysis += `Value Propositions: ${data.websiteInsights.valuePropositions?.join(' | ') || 'None identified'}\n`;
      analysis += `Target Audience Indicators: ${data.websiteInsights.targetAudience?.join(', ') || 'None specified'}\n`;
      analysis += `Customer Testimonials: ${data.websiteInsights.testimonials?.join(' | ') || 'None found'}\n`;
      analysis += `Product Features: ${data.websiteInsights.productFeatures?.join(' | ') || 'None highlighted'}\n`;
    }
  } else {
    analysis += `=== WEBSITE CONTENT ===\nNo website data available for brand analysis\n`;
  }
  
  // Reddit Discussions Analysis - Authentic customer voice and community insights
  if (data.redditData && data.redditData.length > 0) {
    analysis += `\n=== REDDIT COMMUNITY DISCUSSIONS (${data.redditData.length} posts) ===\n`;
    data.redditData.slice(0, 15).forEach((post: any, index: number) => {
      analysis += `\nREDDIT POST ${index + 1} (r/${post.subreddit}):\n`;
      analysis += `Title: "${post.title}"\n`;
      analysis += `Content: ${post.content.substring(0, 400)}...\n`;
      analysis += `Engagement: ${post.score} upvotes, ${post.commentCount} comments\n`;
      analysis += `Author: ${post.author}\n`;
    });
    
    if (data.redditInsights) {
      analysis += `\n--- REDDIT COMMUNITY INSIGHTS ---\n`;
      analysis += `Common Discussion Themes: ${data.redditInsights.commonThemes?.join(', ') || 'None identified'}\n`;
      analysis += `Total Community Engagement: ${data.redditInsights.totalPosts || 0} posts, ${data.redditInsights.totalComments || 0} comments\n`;
      analysis += `Average Post Score: ${data.redditInsights.averageScore || 0}\n`;
      analysis += `Subreddit Distribution: ${JSON.stringify(data.redditInsights.subredditBreakdown || {})}\n`;
    }
  } else {
    analysis += `\n=== REDDIT DISCUSSIONS ===\nNo Reddit community data available\n`;
  }
  
  // Customer Reviews Analysis - Direct voice of customer
  if (data.rawReviews && data.rawReviews.length > 0) {
    analysis += `\n=== CUSTOMER REVIEWS ANALYSIS (${data.rawReviews.length} reviews) ===\n`;
    data.rawReviews.slice(0, 20).forEach((review: any, index: number) => {
      analysis += `\nREVIEW ${index + 1}:\n`;
      analysis += `Rating: ${review.rating || 'Not specified'}/5\n`;
      analysis += `Source: ${review.source_type || review.source || 'Unknown platform'}\n`;
      analysis += `Customer Voice: "${review.review_text?.substring(0, 300) || review.content?.substring(0, 300) || 'No content available'}..."\n`;
      if (review.verified_purchase) analysis += `Verified Purchase: Yes\n`;
      if (review.review_date) analysis += `Date: ${review.review_date}\n`;
    });
    
    // Review sentiment and patterns analysis
    const ratingCounts = data.rawReviews.reduce((acc: any, review: any) => {
      const rating = review.rating || 0;
      acc[rating] = (acc[rating] || 0) + 1;
      return acc;
    }, {});
    
    analysis += `\n--- REVIEW PATTERNS ---\n`;
    analysis += `Rating Distribution: ${JSON.stringify(ratingCounts)}\n`;
    analysis += `Average Satisfaction: ${data.rawReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / data.rawReviews.length || 0}/5\n`;
  } else {
    analysis += `\n=== CUSTOMER REVIEWS ===\nNo customer review data available\n`;
  }
  
  // Competitor Analysis - Market positioning and alternatives
  if (data.competitors && data.competitors.length > 0) {
    analysis += `\n=== COMPETITIVE LANDSCAPE (${data.competitors.length} competitors) ===\n`;
    data.competitors.forEach((competitor: any, index: number) => {
      analysis += `\nCOMPETITOR ${index + 1}:\n`;
      analysis += `Brand: ${competitor.brand_name || 'Unknown brand'}\n`;
      analysis += `Product: ${competitor.product_name || 'Unknown product'}\n`;
      analysis += `URL: ${competitor.url || 'Not available'}\n`;
      analysis += `Source: ${competitor.source || 'Unknown'}\n`;
      if (competitor.metadata) {
        const metadata = typeof competitor.metadata === 'string' ? competitor.metadata : JSON.stringify(competitor.metadata);
        analysis += `Details: ${metadata.substring(0, 300)}...\n`;
      }
    });
  } else {
    analysis += `\n=== COMPETITIVE LANDSCAPE ===\nNo competitor data available\n`;
  }
  
  // Data Quality Assessment
  analysis += `\n=== DATA QUALITY ASSESSMENT ===\n`;
  analysis += `Overall Data Score: ${data.dataQuality.score}/10\n`;
  analysis += `Available Data Sources: ${[
    data.dataQuality.hasWebsite ? 'Website Content' : null,
    data.dataQuality.hasReviews ? 'Customer Reviews' : null,
    data.dataQuality.hasReddit ? 'Reddit Discussions' : null,
    data.dataQuality.hasCompetitors ? 'Competitor Analysis' : null
  ].filter(Boolean).join(', ') || 'None'}\n`;
  
  if (data.dataQuality.missing.length > 0) {
    analysis += `Missing Data Sources: ${data.dataQuality.missing.join(', ')}\n`;
  }
  
  analysis += `Comprehensive Analysis Possible: ${data.dataQuality.canDoComprehensiveAnalysis ? 'Yes' : 'Limited - additional data recommended'}\n`;
  
  analysis += `\n=== ANALYSIS INSTRUCTIONS ===\n`;
  analysis += `Use this data to create a comprehensive psychological ICP. Every insight must be supported by specific quotes or patterns from the above data. If data is insufficient for any section, acknowledge the limitation clearly.\n`;
  
  return analysis;
}

function generateComprehensiveFallbackAnalysis(data: any): string {
  const analysis = [`COMPREHENSIVE PSYCHOLOGICAL ICP ANALYSIS\n`];
  
  analysis.push(`Product: ${data.userProduct}`);
  analysis.push(`Keywords: ${data.targetKeywords}`);
  analysis.push(`Data Quality Score: ${data.dataQuality.score}/10\n`);
  
  // Website-based insights
  if (data.websiteData && data.websiteData.length > 0) {
    analysis.push(`=== BRAND PSYCHOLOGY INSIGHTS (Website Analysis) ===`);
    analysis.push(`Pages Analyzed: ${data.websiteData.length}`);
    
    if (data.websiteInsights?.brandMessaging?.length > 0) {
      analysis.push(`Brand Messaging Patterns: "${data.websiteInsights.brandMessaging[0]}"`);
    }
    
    if (data.websiteInsights?.valuePropositions?.length > 0) {
      analysis.push(`Core Value Propositions: ${data.websiteInsights.valuePropositions.slice(0, 3).join(', ')}`);
    }
    
    if (data.websiteInsights?.targetAudience?.length > 0) {
      analysis.push(`Target Audience Indicators: ${data.websiteInsights.targetAudience.join(', ')}`);
    }
  }
  
  // Reddit community insights
  if (data.redditData && data.redditData.length > 0) {
    analysis.push(`\n=== COMMUNITY PSYCHOLOGY INSIGHTS (Reddit Analysis) ===`);
    analysis.push(`Community Discussions: ${data.redditData.length} posts analyzed`);
    
    if (data.redditInsights?.commonThemes?.length > 0) {
      analysis.push(`Common Customer Concerns: ${data.redditInsights.commonThemes.slice(0, 5).join(', ')}`);
    }
    
    // Sample authentic customer voice
    const samplePost = data.redditData[0];
    if (samplePost) {
      analysis.push(`Sample Customer Voice: "${samplePost.title}" - ${samplePost.content.substring(0, 150)}...`);
    }
  }
  
  // Review-based behavioral insights
  if (data.rawReviews && data.rawReviews.length > 0) {
    analysis.push(`\n=== BEHAVIORAL PSYCHOLOGY INSIGHTS (Review Analysis) ===`);
    analysis.push(`Customer Reviews Analyzed: ${data.rawReviews.length}`);
    
    // Sample customer language
    const positiveReviews = data.rawReviews.filter((r: any) => (r.rating || 0) >= 4);
    const negativeReviews = data.rawReviews.filter((r: any) => (r.rating || 0) <= 2);
    
    if (positiveReviews.length > 0) {
      analysis.push(`Positive Experience Pattern: "${positiveReviews[0].review_text?.substring(0, 150) || positiveReviews[0].content?.substring(0, 150)}..."`);
    }
    
    if (negativeReviews.length > 0) {
      analysis.push(`Pain Point Pattern: "${negativeReviews[0].review_text?.substring(0, 150) || negativeReviews[0].content?.substring(0, 150)}..."`);
    }
    
    const avgRating = data.rawReviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / data.rawReviews.length;
    analysis.push(`Overall Satisfaction Level: ${avgRating.toFixed(1)}/5.0`);
  }
  
  // Competitive positioning
  if (data.competitors && data.competitors.length > 0) {
    analysis.push(`\n=== COMPETITIVE PSYCHOLOGY INSIGHTS ===`);
    analysis.push(`Competitor Landscape: ${data.competitors.length} alternatives analyzed`);
    analysis.push(`Market Positioning Opportunities: Based on competitor gap analysis`);
  }
  
  // Data limitations and recommendations
  analysis.push(`\n=== ANALYSIS LIMITATIONS ===`);
  if (data.dataQuality.missing.length > 0) {
    analysis.push(`Missing Data Sources: ${data.dataQuality.missing.join(', ')}`);
    analysis.push(`Recommendation: Collect additional data from missing sources for deeper psychological profiling`);
  }
  
  if (data.dataQuality.score < 6) {
    analysis.push(`Limited Data Warning: Current data quality (${data.dataQuality.score}/10) may limit psychological insight depth`);
  }
  
  analysis.push(`\n=== NEXT STEPS ===`);
  analysis.push(`1. Enhance data collection from missing sources`);
  analysis.push(`2. Conduct follow-up customer interviews for deeper psychological insights`);
  analysis.push(`3. Implement behavioral tracking for real-world validation`);
  
  return analysis.join('\n');
}

