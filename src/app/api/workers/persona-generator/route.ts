import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { JobQueue } from '@/lib/queue';
import OpenAI from 'openai';

function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

const PERSONA_PROMPT = `# Ultimate Psychological ICP Development Prompt

## Overview
Create a comprehensive, psychologically nuanced Ideal Customer Profile (ICP) based on the collected research data from Amazon competitor analysis, review collection, and market research.

## Data Integration Guidelines
Use the following collected data to inform your analysis:
* Amazon Competitor Products: Product titles, pricing, ratings, review counts
* Customer Reviews: Actual review text from multiple sources
* Target Keywords: User-specified keywords that define the product category

Evidence Requirements:
* Quote actual customer review text to support behavioral insights
* Reference specific competitor positioning to identify market gaps
* Use review language patterns to understand authentic customer voice

## Framework Integration
This prompt integrates five powerful frameworks:
1. The ICP Research & Refinement Process
2. The Mindstate Behavioral Model
3. Predictably Irrational Behavioral Economics
4. The RMBC Research Method
5. Generational Marketing Strategy

Generate a comprehensive customer persona analysis with:
- Executive Summary
- Primary Persona Development
- Strategic Behavioral Implications
- Color Palette Recommendation
- Brand Voice Recommendation

Word Count Target: 3,000-4,000 words for comprehensive analysis`;

export async function POST(request: NextRequest) {
  let jobId: string = '';
  
  try {
    const body = await request.json();
    jobId = body.jobId;
    const { payload } = body;
    const { rawReviews, collectionSummary, competitors, userProduct, targetKeywords } = payload;
    
    console.log(`Starting persona generation for job ${jobId}`);
    
    await updateJobStatus(jobId, 'processing', 85, undefined, undefined);
    
    const dataContext = prepareDataContext(rawReviews, collectionSummary, competitors, userProduct, targetKeywords);
    
    console.log(`Generating personas with ${rawReviews?.length || 0} reviews and ${competitors?.length || 0} competitors`);
    
    await updateJobStatus(jobId, 'processing', 90, undefined, undefined);
    
    const personaReport = await generatePersonaWithOpenAI(dataContext);
    
    await storePersonaReport(jobId, personaReport);
    
    await updateJobStatus(jobId, 'processing', 95, undefined, undefined);
    
    const executiveSummary = extractExecutiveSummary(personaReport);
    
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
  const maxReviews = 50;
  const sampleReviews = rawReviews?.slice(0, maxReviews) || [];
  
  return {
    productContext: {
      targetKeywords,
      userProduct: userProduct || {},
      totalReviewsCollected: rawReviews?.length || 0
    },
    competitorAnalysis: {
      competitors: competitors?.slice(0, 10) || [],
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
Review ${
