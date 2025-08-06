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
 * Website crawler worker - direct function call version
 * Replaces the HTTP endpoint to avoid timeout issues
 */
export async function websiteCrawlerWorker({
  jobId,
  websiteUrl,
  targetKeywords,
  competitorUrls = []
}: {
  jobId: string;
  websiteUrl: string;
  targetKeywords: string;
  competitorUrls?: string[];
}) {
  console.log(`🤖 Starting website crawler worker for job ${jobId}`);
  console.log(`📍 Website: ${websiteUrl}`);
  console.log(`🔍 Keywords: ${targetKeywords}`);
  console.log(`🏆 Competitors: ${competitorUrls.length}`);

  try {
    // Extract main website data using OpenAI
    const websiteData = await extractDataWithOpenAI(websiteUrl, targetKeywords);
    
    // Process competitor URLs if provided
    let competitorResults = [];
    if (competitorUrls && competitorUrls.length > 0) {
      console.log(`🏆 Processing ${competitorUrls.length} competitor URLs...`);
      competitorResults = await processCompetitorUrls(competitorUrls, targetKeywords);
    }
    
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

    // Determine if we actually collected meaningful data
    const hasActualData = (
      websiteData.customerReviews.length > 0 ||
      websiteData.features.length > 0 ||
      websiteData.valuePropositions.length > 0 ||
      websiteData.painPointsAddressed.length > 0 ||
      websiteData.testimonials.length > 0 ||
      (websiteData.brandMessaging && websiteData.brandMessaging.length > 10)
    );

    // Check competitor data too
    const hasCompetitorData = competitorResults.some(r => 
      r.success && r.data && (
        r.data.customerReviews?.length > 0 ||
        r.data.features?.length > 0 ||
        r.data.valuePropositions?.length > 0
      )
    );

    const overallDataSuccess = hasActualData || hasCompetitorData;

    const result = {
      success: true, // Process completed successfully
      hasActualData: overallDataSuccess, // Whether meaningful data was extracted
      dataCollected: overallDataSuccess, // Legacy compatibility
      websiteData: websiteData,
      competitorData: competitorResults,
      analysis: {
        ...analysis,
        hasActualData: overallDataSuccess,
        dataQuality: overallDataSuccess ? 'good' : 'empty_results'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        websiteUrl: websiteUrl,
        targetKeywords: targetKeywords,
        competitorUrls: competitorUrls || [],
        crawlType: competitorUrls && competitorUrls.length > 0 ? 'openai_content_reviews_and_competitors' : 'openai_content_and_reviews',
        extractionMethod: 'openai_gpt4_mini',
        hasActualData: overallDataSuccess
      }
    };

    if (overallDataSuccess) {
      console.log(`✅ Website crawler completed with data for job ${jobId}`);
      console.log(`📊 Results: ${analysis.reviewsFound} reviews, ${analysis.featuresFound} features, ${analysis.painPointsFound} pain points`);
    } else {
      console.log(`⚠️ Website crawler completed but found no meaningful data for job ${jobId}`);
      console.log(`📊 Empty results: ${analysis.reviewsFound} reviews, ${analysis.featuresFound} features, ${analysis.painPointsFound} pain points`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ Website crawler failed for job ${jobId}:`, error);
    throw error;
  }
}

/**
 * Universal OpenAI-based data extraction function
 */
async function extractDataWithOpenAI(url: string, keywords: string): Promise<WebsiteData & { dataQuality: any }> {
  console.log(`🤖 Starting OpenAI extraction for: ${url}`);
  
  try {
    // Step 1: Fetch webpage HTML
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
    
    // Limit content size for OpenAI API
    if (cleanHtml.length > 15000) {
      const parts = cleanHtml.split(' ');
      const relevantKeywords = ['review', 'testimonial', 'customer', 'amazing', 'love', 'great', 'excellent', 'product', keywords];
      
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
async function processCompetitorUrls(competitorUrls: string[], keywords: string): Promise<any[]> {
  console.log(`🏆 Processing ${competitorUrls.length} competitor URLs`);
  
  const competitorResults = [];
  
  for (let i = 0; i < competitorUrls.length; i++) {
    const url = competitorUrls[i];
    console.log(`🏆 Processing competitor ${i + 1}: ${url}`);
    
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