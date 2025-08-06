import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { storeJobResult } from '@/lib/job-cache';
import OpenAI from 'openai';

interface WebsiteData {
  homePageContent: string;
  customerReviews: string[];
  testimonials: string[];
  valuePropositions: string[];
  features: string[];
  brandMessaging: string;
  painPointsAddressed: string[];
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Universal OpenAI-based data extraction function
 * Works for any URL without site-specific logic
 */
async function extractDataWithOpenAI(url: string, keywords: string): Promise<WebsiteData & { dataQuality: any }> {
  console.log(`🤖 Starting OpenAI extraction for: ${url}`);
  console.log(`🔍 Keywords: ${keywords}`);
  
  try {
    // Step 1: Fetch webpage HTML
    console.log(`📡 Fetching HTML from ${url}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`📄 Fetched ${html.length} characters of HTML`);
    
    // Step 2: Clean HTML for OpenAI processing
    let cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Limit content size for OpenAI API (keep most relevant parts)
    if (cleanHtml.length > 15000) {
      // Prioritize content that might contain reviews and product info
      const parts = cleanHtml.split(' ');
      // Split keywords into individual phrases for content prioritization
      const keywordPhrases = keywords.split(/[,;|]/).map(k => k.trim()).filter(k => k.length > 0);
      const relevantKeywords = ['review', 'testimonial', 'customer', 'amazing', 'love', 'great', 'excellent', 'product', ...keywordPhrases];
      
      let relevantContent = '';
      let wordCount = 0;
      
      for (const word of parts) {
        if (wordCount < 15000 && (relevantKeywords.some(k => word.toLowerCase().includes(k.toLowerCase())) || relevantContent.length < 8000)) {
          relevantContent += word + ' ';
          wordCount++;
        }
      }
      
      cleanHtml = relevantContent.trim() || cleanHtml.substring(0, 15000);
    }
    
    console.log(`📝 Prepared ${cleanHtml.length} characters for OpenAI analysis`);
    
    // Step 3: Call OpenAI API with extraction prompt
    console.log(`🤖 Calling OpenAI API for data extraction...`);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing e-commerce websites and extracting customer sentiment, product information, and marketing messaging. Always return valid JSON."
        },
        {
          role: "user",
          content: `Analyze this webpage for a business selling ${keywords} products. Extract:

1. **Customer Reviews** (exact quotes showing strong emotions - 'amazing', 'life-changing', 'finally', 'couldn't believe', etc.) - Max 10 most emotionally resonant
2. **Value Propositions** (key selling points and benefits mentioned)
3. **Product Features** (specific features, materials, benefits related to ${keywords})
4. **Brand Messaging** (main brand promise and positioning)
5. **Pain Points Addressed** (problems the products solve)
6. **Testimonials** (any customer stories or case studies)

Return JSON format with exact quotes, no paraphrasing. Focus on content related to: ${keywords}

Webpage content:
${cleanHtml}

Return in this exact JSON format:
{
  "customerReviews": ["exact quote 1", "exact quote 2"],
  "valuePropositions": ["benefit 1", "benefit 2"],
  "features": ["feature 1", "feature 2"],
  "brandMessaging": "main brand message",
  "painPointsAddressed": ["problem 1", "problem 2"],
  "testimonials": ["testimonial 1", "testimonial 2"]
}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });
    
    const aiResponse = completion.choices[0]?.message?.content;
    console.log(`🤖 OpenAI response received: ${aiResponse?.length} characters`);
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }
    
    // Step 4: Parse OpenAI response
    let extractedData;
    try {
      extractedData = JSON.parse(aiResponse);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      console.log('Raw response:', aiResponse);
      
      // Fallback: try to extract JSON from response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }
    
    console.log(`✅ OpenAI extraction completed:`);
    console.log(`   - Customer Reviews: ${extractedData.customerReviews?.length || 0}`);
    console.log(`   - Value Props: ${extractedData.valuePropositions?.length || 0}`);
    console.log(`   - Features: ${extractedData.features?.length || 0}`);
    console.log(`   - Pain Points: ${extractedData.painPointsAddressed?.length || 0}`);
    
    // Step 5: Format response
    return {
      homePageContent: cleanHtml.substring(0, 2000),
      customerReviews: extractedData.customerReviews || [],
      testimonials: extractedData.testimonials || [],
      valuePropositions: extractedData.valuePropositions || [],
      features: extractedData.features || [],
      brandMessaging: extractedData.brandMessaging || '',
      painPointsAddressed: extractedData.painPointsAddressed || [],
      dataQuality: {
        method: 'openai_extraction',
        contentLength: cleanHtml.length,
        hasMetadata: true,
        model: 'gpt-4o-mini',
        tokensUsed: completion.usage?.total_tokens || 0
      }
    };
    
  } catch (error) {
    console.error('❌ OpenAI extraction failed:', error);
    
    return {
      homePageContent: '',
      customerReviews: [],
      testimonials: [],
      valuePropositions: [],
      features: [],
      brandMessaging: '',
      painPointsAddressed: [],
      dataQuality: {
        method: 'failed',
        contentLength: 0,
        hasMetadata: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Process competitor URLs using the same OpenAI extraction
 */
async function processCompetitorUrls(competitorUrls: string[], keywords: string, jobId?: string): Promise<any[]> {
  console.log(`🏆 Processing ${competitorUrls.length} competitor URLs with OpenAI`);
  
  const competitorResults = [];
  
  for (let i = 0; i < competitorUrls.length; i++) {
    const url = competitorUrls[i];
    console.log(`\n🏆 Processing competitor ${i + 1}: ${url}`);
    
    try {
      const result = await extractDataWithOpenAI(url, keywords);
      competitorResults.push({
        competitorIndex: i,
        url: url,
        success: true,
        data: result
      });
      console.log(`✅ Competitor ${i + 1} completed - found ${result.customerReviews?.length || 0} reviews`);
    } catch (error) {
      console.error(`❌ Competitor ${i + 1} failed:`, error);
      competitorResults.push({
        competitorIndex: i,
        url: url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  console.log(`🏆 Competitor processing complete - processed ${competitorResults.length} sites`);
  return competitorResults;
}

export async function POST(request: NextRequest) {
  console.log(`=== OPENAI WEBSITE CRAWLER START ===`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  let jobId: string | undefined;
  
  try {
    console.log(`📨 Reading request body...`);
    const requestBody = await request.json();
    jobId = requestBody.jobId;
    const { websiteUrl, targetKeywords, competitorUrls } = requestBody;
    
    console.log(`📋 Request parameters received:`);
    console.log(`   - Job ID: ${jobId}`);
    console.log(`   - Website URL: ${websiteUrl}`);
    console.log(`   - Target Keywords: ${targetKeywords || 'none'}`);
    console.log(`   - Competitor URLs: ${competitorUrls ? competitorUrls.length : 0} provided`);

    if (!jobId || !websiteUrl) {
      console.error(`❌ Missing required parameters - jobId: ${!!jobId}, websiteUrl: ${!!websiteUrl}`);
      return NextResponse.json({ error: 'Job ID and website URL are required' }, { status: 400 });
    }

    console.log(`📊 Attempting database status update to 'processing'...`);
    try {
      await updateJobStatus(jobId, 'processing');
      console.log(`✅ Database status updated successfully`);
    } catch (statusError) {
      console.error(`⚠️ Database status update failed:`, statusError);
      console.log(`📍 Continuing with extraction despite status update failure...`);
    }
    
    // Extract main website data using OpenAI
    console.log(`🤖 Starting OpenAI extraction for main website...`);
    const websiteData = await extractDataWithOpenAI(websiteUrl, targetKeywords || '');
    console.log(`✅ Main website extraction completed!`);

    // Process competitor URLs if provided
    let competitorResults = [];
    if (competitorUrls && Array.isArray(competitorUrls) && competitorUrls.length > 0) {
      console.log(`🏆 Starting competitor URL processing: ${competitorUrls.length} URLs`);
      competitorResults = await processCompetitorUrls(competitorUrls, targetKeywords || '', jobId);
      console.log(`✅ Competitor URL processing completed: ${competitorResults.length} results`);
    } else {
      console.log(`ℹ️ No competitor URLs provided, skipping competitor analysis`);
    }
    
    console.log(`📊 Analyzing extracted data...`);
    const analysis = {
      method: websiteData.dataQuality.method,
      contentLength: websiteData.homePageContent.length,
      reviewsFound: websiteData.customerReviews.length,
      testimonialsFound: websiteData.testimonials.length,
      valuePropsFound: websiteData.valuePropositions.length,
      featuresFound: websiteData.features.length,
      painPointsFound: websiteData.painPointsAddressed?.length || 0,
      brandMessagingPresent: !!websiteData.brandMessaging,
      dataQuality: websiteData.dataQuality,
      competitorProcessingResults: {
        competitorsProcessed: competitorResults.length,
        competitorSuccesses: competitorResults.filter(r => r.success).length,
        competitorFailures: competitorResults.filter(r => !r.success).length,
        totalCompetitorReviews: competitorResults
          .filter(r => r.success && r.data)
          .reduce((total, r) => total + (r.data.customerReviews?.length || 0), 0)
      }
    };
    
    console.log(`📋 Analysis complete:`);
    console.log(`   - Method: ${analysis.method}`);
    console.log(`   - Reviews found: ${analysis.reviewsFound}`);
    console.log(`   - Content length: ${analysis.contentLength} chars`);
    console.log(`   - Pain points: ${analysis.painPointsFound}`);
    
    console.log(`📦 Preparing data package for storage...`);
    const crawlerData = {
      websiteData: websiteData,
      competitorData: competitorResults,
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        websiteUrl: websiteUrl,
        targetKeywords: targetKeywords,
        competitorUrls: competitorUrls || [],
        crawlType: competitorUrls && competitorUrls.length > 0 ? 'openai_content_reviews_and_competitors' : 'openai_content_and_reviews',
        extractionMethod: 'openai_gpt4_mini'
      }
    };

    console.log(`💾 Attempting database write...`);
    try {
      await saveJobData(jobId, 'website', crawlerData);
      console.log(`✅ Database write successful!`);
    } catch (dbError) {
      console.error(`❌ Database write failed:`, dbError);
      console.error(`🔍 Database error details:`, dbError instanceof Error ? dbError.message : 'Unknown error');
    }
    
    console.log(`💾 Attempting job cache storage...`);
    try {
      // Store result in cache for debug dashboard
      const hasActualData = analysis.reviewsFound > 0 || 
                           analysis.valuePropsFound > 0 || 
                           analysis.featuresFound > 0 || 
                           analysis.painPointsFound > 0;
      
      storeJobResult(jobId, 'website', {
        success: hasActualData,
        websiteData: websiteData,
        competitorData: competitorResults,
        analysis: analysis,
        processingTime: Date.now() - 30000,
        statusCode: hasActualData ? 200 : 404,
        error: hasActualData ? null : 'No meaningful website data found',
        hasActualData: hasActualData,
        dataCollected: hasActualData
      });

      // Store individual competitor results in separate cache entries
      competitorResults.forEach((competitor, index) => {
        if (jobId) {
          if (competitor.success && competitor.data) {
            storeJobResult(jobId, `competitor_${index + 1}`, {
              success: true,
              competitorUrl: competitor.url,
              reviewsFound: competitor.data.customerReviews?.length || 0,
              data: competitor.data,
              processingTime: Date.now() - 30000,
              statusCode: 200
            });
          } else {
            storeJobResult(jobId, `competitor_${index + 1}`, {
              success: false,
              competitorUrl: competitor.url,
              error: competitor.error || 'Unknown error',
              processingTime: Date.now() - 30000,
              statusCode: 500
            });
          }
        }
      });
      console.log(`✅ Job cache storage successful!`);
    } catch (cacheError) {
      console.error(`❌ Job cache storage failed:`, cacheError);
      console.error(`🔍 Cache error details:`, cacheError instanceof Error ? cacheError.message : 'Unknown error');
    }

    console.log(`🎉 OpenAI website extraction completed for job ${jobId}:`);
    console.log(`📊 Final Results Summary:`);
    console.log(`   - Method: ${analysis.method}`);
    console.log(`   - Content: ${analysis.contentLength} chars`);
    console.log(`   - Reviews: ${analysis.reviewsFound}, Testimonials: ${analysis.testimonialsFound}`);
    console.log(`   - Value Props: ${analysis.valuePropsFound}, Features: ${analysis.featuresFound}`);
    console.log(`   - Pain Points: ${analysis.painPointsFound}`);
    console.log(`=== OPENAI WEBSITE CRAWLER END ===`);

    const hasActualData = analysis.reviewsFound > 0 || 
                         analysis.valuePropsFound > 0 || 
                         analysis.featuresFound > 0 || 
                         analysis.painPointsFound > 0;

    return NextResponse.json({
      success: hasActualData, // Changed: success based on actual data found
      message: `OpenAI website extraction completed${competitorResults.length > 0 ? ` with ${competitorResults.length} competitors processed` : ''}`,
      data: {
        method: analysis.method,
        reviewsFound: analysis.reviewsFound,
        testimonialsFound: analysis.testimonialsFound,
        valuePropsFound: analysis.valuePropsFound,
        featuresFound: analysis.featuresFound,
        painPointsFound: analysis.painPointsFound,
        contentExtracted: analysis.contentLength > 0,
        contentLength: analysis.contentLength,
        dataQuality: analysis.dataQuality,
        brandMessagingFound: analysis.brandMessagingPresent,
        competitorResults: analysis.competitorProcessingResults
      },
      hasActualData: hasActualData,
      dataCollected: hasActualData
    });

  } catch (error) {
    console.error('❌ OPENAI WEBSITE CRAWLER FAILED ===');
    console.error('🔍 Error details:', error);
    console.error('🆔 Failed job ID:', jobId);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log(`💾 Attempting error result storage in job cache...`);
    if (jobId) {
      try {
        storeJobResult(jobId, 'website', {
          success: false,
          error: errorMessage,
          processingTime: 0,
          statusCode: 500
        });
        console.log(`✅ Error result stored in job cache`);
      } catch (cacheError) {
        console.error(`❌ Failed to store error in job cache:`, cacheError);
      }
    } else {
      console.error(`❌ No job ID available for error storage`);
    }
    
    console.log(`=== OPENAI WEBSITE CRAWLER END (WITH ERROR) ===`);
    
    return NextResponse.json(
      { error: 'OpenAI website extraction failed', details: errorMessage },
      { status: 500 }
    );
  }
}