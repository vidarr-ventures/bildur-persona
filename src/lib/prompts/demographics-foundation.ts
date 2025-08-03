/**
 * Demographics Foundation Prompt - Stage 1 of Sequential Persona Analysis
 * 
 * This is the first stage in a series of prompts that will run sequentially
 * to generate different sections of the final persona report.
 */

export interface ReviewSource {
  reviews: any[];
  metadata: any;
  source_type: string;
  source_url: string;
}

export interface DataQuality {
  total_reviews: number;
  has_minimum_reviews: boolean;
  missing_sources: string[];
  verification_rate?: number;
  quality_score: number;
  warnings: string[];
}

export interface QuoteAttribution {
  quote_id: string;
  quote_text: string;
  source_url: string;
  platform: string;
  context: string;
}

export class DemographicsFoundationProcessor {
  private quoteAttributions: Map<string, QuoteAttribution> = new Map();
  private quoteCounter = 1;

  /**
   * Generate the Demographics Foundation analysis prompt with collected data
   */
  generatePrompt(collectedData: {
    amazonReviews?: any;
    websiteData?: any;
    competitorData?: any;
    youtubeData?: any;
    redditData?: any;
    targetKeywords: string;
    amazonUrl?: string;
    websiteUrl?: string;
  }): { prompt: string; dataQuality: DataQuality } {
    
    // Assess data quality
    const dataQuality = this.assessDataQuality(collectedData);
    
    // Format data with quote attribution
    const formattedData = this.formatDataWithAttribution(collectedData);
    
    const prompt = `# Demographics_Foundation Prompt

**TEMPERATURE: 0.1**

**Objective**: Establish core customer demographics and deep psychographic insights based exclusively on collected data.

## Instructions

Using ONLY the collected review data, competitor analysis, and product context, create a detailed demographic and psychographic profile. Show your analytical reasoning process and assess data quality throughout.

## Analysis Process Required:

1. **Data Quality Assessment**: Review sample size, geographic coverage, verification rates
2. **Pattern Identification**: Note recurring themes in customer language and behavior  
3. **Evidence Weighting**: Prioritize insights with strongest data support
4. **Confidence Evaluation**: Assess reliability of each demographic inference

## Data Quality Summary

${this.formatDataQualityWarnings(dataQuality)}

## Required Output Format:

### Data Quality Summary

- Total review count and verification percentage: ${dataQuality.total_reviews} reviews, ${dataQuality.verification_rate || 'Unknown'}% verified
- Geographic representation (US focus): United States (primary focus)
- Time period coverage of reviews: Current analysis period
- Missing data sources disclosure: ${dataQuality.missing_sources.length > 0 ? dataQuality.missing_sources.join(', ') : 'None'}

### Demographics Analysis (Max 500 words)

**Key Insights Summary:**
- Primary age range and generation (X% confidence)
- Gender distribution if evident (X% confidence)
- Income indicators from price sensitivity (X% confidence)
- Education level from language patterns (X% confidence)

#### Age Range and Generation

Based on language patterns, cultural references, and technology comfort levels evident in reviews. Quote specific examples with reference codes: "Example quote demonstrating generational indicator" [R001].

**Confidence Assessment**: X% confident based on [specific evidence type and volume]

#### Economic Demographics

Income and financial stability inferred from price sensitivity comments, purchase decision factors, and value perception language in reviews.

**Sample Supporting Evidence:**
- "Quote showing price sensitivity" [R002]
- "Quote showing quality vs. cost priority" [R003]

**Confidence Assessment**: X% confident based on [number] price-related review comments

### Psychographic Deep Dive (Max 500 words)

**Key Insights Summary:**
- Primary values driving decisions (X% confidence)
- Risk tolerance patterns (X% confidence)
- Life priorities and resource allocation (X% confidence)

#### Core Values and Attitudes

Extract values explicitly stated or strongly implied in review language. Focus on what customers say they prioritize.

**Evidence Examples:**
- "Quote revealing core values" [R004]  
- "Quote showing life priorities" [R005]

#### Hopes, Dreams, and Fears

Emotional drivers extracted from review explanations of motivations, desired outcomes, and concerns.

**Aspirational Language:**
- "Quote showing aspirations" [R006]

**Fear/Concern Indicators:**
- "Quote revealing anxieties" [R007]

### Contradictory Evidence Analysis

- Conflicting patterns identified in data
- Alternative interpretations considered
- Minority viewpoints that represent edge cases

### Summary for Pipeline

**Key Demographics**: [3-5 bullet points with confidence levels]
**Key Psychographics**: [3-5 bullet points with confidence levels]
**Data Gaps Identified**: [Areas needing more information]
**Confidence Ranges**: [Overall reliability assessment]

## Error Handling Requirements:

- If fewer than 20 reviews available, include warning: "WARNING: Sample size below recommended minimum (20 reviews). Insights should be considered preliminary."
- If any data sources are missing, state: "DATA LIMITATION: [Specific missing source] not available for analysis."
- If insufficient evidence for any insight, state: "Insufficient data in collected reviews to determine [specific category]."
- Include data confidence levels for each major insight based on supporting evidence volume.

## CUSTOMER PRODUCT DATA:

### Customer URL: 
${formattedData.customerUrl}

### Amazon Product Page:
${formattedData.amazonData}

## COMPETITOR DATA:
${formattedData.competitorData}

## SOCIAL/COMMUNITY DATA:

### YouTube Comments:
${formattedData.youtubeData}

### Reddit Discussions:
${formattedData.redditData}

## TOTAL REVIEW COUNT: ${dataQuality.total_reviews}

## Target Keywords: ${collectedData.targetKeywords}
## Amazon Product URL: ${collectedData.amazonUrl || 'Not provided'}
## Primary Website: ${collectedData.websiteUrl || 'Not provided'}`;

    return { prompt, dataQuality };
  }

  /**
   * Assess the quality of collected data
   */
  private assessDataQuality(data: any): DataQuality {
    let totalReviews = 0;
    const missingSources: string[] = [];
    const warnings: string[] = [];

    // Count reviews from all sources
    if (data.amazonReviews?.reviews) {
      totalReviews += data.amazonReviews.reviews.length;
    } else {
      missingSources.push('Amazon reviews');
    }

    if (data.competitorData?.reviews) {
      totalReviews += data.competitorData.reviews.length;
    } else {
      missingSources.push('Competitor reviews');
    }

    if (data.youtubeData?.comments) {
      totalReviews += data.youtubeData.comments.length;
    } else {
      missingSources.push('YouTube comments');
    }

    if (data.redditData?.posts) {
      totalReviews += data.redditData.posts.length;
    } else {
      missingSources.push('Reddit discussions');
    }

    if (!data.websiteData) {
      missingSources.push('Website data');
    }

    // Check minimum review threshold
    const hasMinimumReviews = totalReviews >= 20;
    if (!hasMinimumReviews) {
      warnings.push(`WARNING: Sample size below recommended minimum (20 reviews). Insights should be considered preliminary. Current: ${totalReviews} reviews.`);
    }

    // Add missing source warnings
    if (missingSources.length > 0) {
      warnings.push(`DATA LIMITATION: ${missingSources.join(', ')} not available for analysis.`);
    }

    // Calculate verification rate from Amazon data
    let verificationRate: number | undefined;
    if (data.amazonReviews?.metadata?.verified_purchase_rate) {
      verificationRate = data.amazonReviews.metadata.verified_purchase_rate * 100;
    }

    // Calculate quality score
    let qualityScore = 100;
    if (!hasMinimumReviews) qualityScore -= 30;
    qualityScore -= missingSources.length * 10;
    if (verificationRate && verificationRate < 50) qualityScore -= 20;

    return {
      total_reviews: totalReviews,
      has_minimum_reviews: hasMinimumReviews,
      missing_sources: missingSources,
      verification_rate: verificationRate,
      quality_score: Math.max(0, qualityScore),
      warnings
    };
  }

  /**
   * Format data quality warnings for the prompt
   */
  private formatDataQualityWarnings(dataQuality: DataQuality): string {
    if (dataQuality.warnings.length === 0) return '';
    
    return `## ⚠️ Data Quality Warnings\n${dataQuality.warnings.map(w => `- ${w}`).join('\n')}\n`;
  }

  /**
   * Format all data sources with proper quote attribution
   */
  private formatDataWithAttribution(data: any): {
    customerUrl: string;
    amazonData: string;
    competitorData: string;
    youtubeData: string;
    redditData: string;
  } {
    this.quoteAttributions.clear();
    this.quoteCounter = 1;

    return {
      customerUrl: this.formatCustomerUrl(data.websiteData),
      amazonData: this.formatAmazonData(data.amazonReviews),
      competitorData: this.formatCompetitorData(data.competitorData),
      youtubeData: this.formatYoutubeData(data.youtubeData),
      redditData: this.formatRedditData(data.redditData)
    };
  }

  private formatCustomerUrl(websiteData: any): string {
    if (!websiteData) return 'No customer website data available.';
    
    const formatted: string[] = [];
    
    if (websiteData.analysis?.valuePropositions) {
      formatted.push('**Value Propositions:**');
      websiteData.analysis.valuePropositions.slice(0, 5).forEach((vp: string) => {
        const refId = this.addQuoteAttribution(vp, 'CustomerSite', 'Website value proposition');
        formatted.push(`- "${vp}" [${refId}]`);
      });
    }

    if (websiteData.analysis?.features) {
      formatted.push('\n**Key Features:**');
      websiteData.analysis.features.slice(0, 5).forEach((feature: string) => {
        const refId = this.addQuoteAttribution(feature, 'CustomerSite', 'Website feature');
        formatted.push(`- "${feature}" [${refId}]`);
      });
    }

    return formatted.length > 0 ? formatted.join('\n') : 'Limited customer website data available.';
  }

  private formatAmazonData(amazonData: any): string {
    if (!amazonData?.reviews) return 'No customer Amazon data available.';
    
    const formatted: string[] = [];
    const reviews = amazonData.reviews.slice(0, 20); // Limit for prompt size
    
    formatted.push(`**Amazon Reviews (${reviews.length} reviews):**`);
    
    reviews.forEach((review: any, index: number) => {
      const refId = this.addQuoteAttribution(
        review.text || review.content || '', 
        'Amazon', 
        `Amazon review - ${review.title || 'Review'}`
      );
      const title = review.title || 'Amazon Review';
      const rating = review.rating || 'N/A';
      formatted.push(`[${refId}] **Amazon Review** (Rating: ${rating}/5): ${title} - ${(review.text || '').substring(0, 200)}...`);
    });

    return formatted.join('\n');
  }

  private formatCompetitorData(competitorData: any): string {
    if (!competitorData?.reviews && !Array.isArray(competitorData)) {
      return 'No competitor data available.';
    }
    
    const formatted: string[] = [];
    const reviews = (competitorData.reviews || competitorData || []).slice(0, 15);
    
    formatted.push(`**Competitor Reviews (${reviews.length} reviews):**`);
    
    reviews.forEach((review: any) => {
      const refId = this.addQuoteAttribution(
        review.text || review.content || '', 
        'Competitor', 
        `Competitor review - ${review.title || 'Review'}`
      );
      const title = review.title || 'Competitor Review';
      const rating = review.rating || 'N/A';
      formatted.push(`[${refId}] **Competitor Review** (Rating: ${rating}/5): ${title} - ${(review.text || '').substring(0, 200)}...`);
    });

    return formatted.join('\n');
  }

  private formatYoutubeData(youtubeData: any): string {
    if (!youtubeData?.comments) return 'No YouTube data available.';
    
    const formatted: string[] = [];
    const comments = youtubeData.comments.slice(0, 15);
    
    formatted.push(`**YouTube Comments (${comments.length} comments):**`);
    
    comments.forEach((comment: any) => {
      const refId = this.addQuoteAttribution(
        comment.text || '', 
        'YouTube', 
        `YouTube comment on ${comment.video_title || 'video'}`
      );
      formatted.push(`[${refId}] **YouTube**: ${comment.video_title || 'Video comment'} - ${(comment.text || '').substring(0, 200)}...`);
    });

    return formatted.join('\n');
  }

  private formatRedditData(redditData: any): string {
    if (!redditData?.posts) return 'No Reddit data available.';
    
    const formatted: string[] = [];
    const posts = redditData.posts.slice(0, 10);
    
    formatted.push(`**Reddit Posts (${posts.length} posts):**`);
    
    posts.forEach((post: any) => {
      const refId = this.addQuoteAttribution(
        post.content || post.selftext || '', 
        'Reddit', 
        `Reddit post - ${post.title || 'Post'}`
      );
      formatted.push(`[${refId}] **Reddit** (r/${post.subreddit || 'unknown'}): ${post.title || 'Reddit Post'} - ${(post.content || post.selftext || '').substring(0, 200)}...`);
    });

    return formatted.join('\n');
  }

  private addQuoteAttribution(text: string, platform: string, context: string): string {
    const refId = `R${this.quoteCounter.toString().padStart(3, '0')}-${platform}`;
    
    this.quoteAttributions.set(refId, {
      quote_id: refId,
      quote_text: text,
      source_url: `${platform.toLowerCase()}.com`,
      platform,
      context
    });
    
    this.quoteCounter++;
    return refId;
  }

  /**
   * Get all quote attributions for transparency
   */
  getQuoteAttributions(): Map<string, QuoteAttribution> {
    return this.quoteAttributions;
  }

  /**
   * Parse the AI response and extract insights for the next stage
   */
  parseResponse(response: string): {
    demographics: any;
    psychographics: any;
    dataGaps: string[];
    confidence: any;
    nextStagePrep: any;
  } {
    // Extract key sections from the response
    const demographics = this.extractSection(response, '### Demographics Analysis');
    const psychographics = this.extractSection(response, '### Psychographic Deep Dive');
    const summary = this.extractSection(response, '### Summary for Pipeline');
    
    // Extract confidence scores
    const confidencePattern = /(\w+.*?)Confidence.*?(\d+)%/gi;
    const confidenceScores: any = {};
    let match;
    while ((match = confidencePattern.exec(response)) !== null) {
      const fieldName = match[1].trim().toLowerCase().replace(' ', '_');
      confidenceScores[fieldName] = parseInt(match[2]);
    }

    // Extract data gaps
    const dataGapsMatch = summary?.match(/\*\*Data Gaps Identified\*\*:\s*((?:[•\-\*].+\n?)+)/);
    const dataGaps = dataGapsMatch ? 
      dataGapsMatch[1].split('\n').map(line => line.replace(/^[•\-\*]\s*/, '').trim()).filter(Boolean) : 
      [];

    return {
      demographics,
      psychographics,
      dataGaps,
      confidence: confidenceScores,
      nextStagePrep: {
        stage: 'demographics_foundation_complete',
        readyForNextStage: 'generational_analysis',
        keyFindings: summary || 'Analysis completed'
      }
    };
  }

  private extractSection(response: string, sectionHeader: string): string | null {
    const pattern = new RegExp(`${sectionHeader.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(.*?)(?=###|##|$)`, 'is');
    const match = response.match(pattern);
    return match ? match[1].trim() : null;
  }
}

export default DemographicsFoundationProcessor;