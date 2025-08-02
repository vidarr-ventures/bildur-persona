interface OpenAIResearchResult {
  success: boolean;
  data?: {
    marketAnalysis: string;
    competitiveInsights: string;
    customerSegments: string;
    marketOpportunities: string;
    industryTrends: string;
    strategicRecommendations: string;
  };
  error?: string;
}

/**
 * Perform deep market research using OpenAI for premium tier
 */
export async function performDeepMarketResearch(
  keywords: string,
  websiteUrl: string,
  industry?: string
): Promise<OpenAIResearchResult> {
  
  if (!process.env.OPENAI_API_KEY) {
    return {
      success: false,
      error: 'OpenAI API key not configured'
    };
  }

  try {
    console.log(`🤖 Performing deep market research for: ${keywords}`);

    const researchPrompt = `
As an expert market research analyst, conduct comprehensive research on the following:

TARGET KEYWORDS: ${keywords}
BUSINESS WEBSITE: ${websiteUrl}
INDUSTRY CONTEXT: ${industry || 'To be determined from website'}

Please provide detailed analysis in the following areas:

1. MARKET ANALYSIS:
- Total Addressable Market (TAM) size and growth projections
- Key market drivers and trends
- Market maturity stage and growth phase
- Geographic distribution and regional differences
- Seasonal patterns and cyclical factors

2. COMPETITIVE LANDSCAPE:
- Major competitors and market leaders
- Competitive positioning strategies
- Pricing strategies across the market
- Competitive advantages and differentiators
- Market share distribution
- Emerging competitors and threats

3. CUSTOMER SEGMENTATION:
- Primary customer segments and demographics
- Customer behavior patterns and preferences
- Purchase decision factors and influences
- Customer lifetime value analysis
- Unmet needs and pain points by segment
- Customer journey and touchpoints

4. MARKET OPPORTUNITIES:
- Underserved market segments
- Emerging trends and opportunities
- Product/service gaps in the market
- Partnership and collaboration opportunities
- Geographic expansion possibilities
- Technology disruption opportunities

5. INDUSTRY TRENDS:
- Current industry trends and patterns
- Technology adoption and innovation
- Regulatory changes and compliance requirements
- Economic factors affecting the industry
- Future outlook and predictions
- Potential disruptions and challenges

6. STRATEGIC RECOMMENDATIONS:
- Go-to-market strategy recommendations
- Product positioning strategies
- Pricing strategy suggestions
- Marketing channel recommendations
- Partnership opportunities
- Risk mitigation strategies

Please provide specific, actionable insights based on current market data and trends. Focus on data-driven conclusions rather than generic advice.
`;

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
            content: 'You are a senior market research analyst with 15+ years of experience in strategic market analysis, competitive intelligence, and customer research. You provide detailed, data-driven insights with specific recommendations based on comprehensive market knowledge across multiple industries.'
          },
          {
            role: 'user',
            content: researchPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    const analysis = result.choices[0]?.message?.content || 'No analysis generated';

    // Parse the structured response
    const sections = parseResearchSections(analysis);

    return {
      success: true,
      data: sections
    };

  } catch (error) {
    console.error('OpenAI research error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown research error'
    };
  }
}

/**
 * Parse structured research response into sections
 */
function parseResearchSections(analysis: string) {
  const sections = {
    marketAnalysis: '',
    competitiveInsights: '',
    customerSegments: '',
    marketOpportunities: '',
    industryTrends: '',
    strategicRecommendations: ''
  };

  // Split analysis into sections based on headers
  const sectionPatterns = {
    marketAnalysis: /1\.\s*MARKET ANALYSIS:([\s\S]*?)(?=2\.|$)/i,
    competitiveInsights: /2\.\s*COMPETITIVE LANDSCAPE:([\s\S]*?)(?=3\.|$)/i,
    customerSegments: /3\.\s*CUSTOMER SEGMENTATION:([\s\S]*?)(?=4\.|$)/i,
    marketOpportunities: /4\.\s*MARKET OPPORTUNITIES:([\s\S]*?)(?=5\.|$)/i,
    industryTrends: /5\.\s*INDUSTRY TRENDS:([\s\S]*?)(?=6\.|$)/i,
    strategicRecommendations: /6\.\s*STRATEGIC RECOMMENDATIONS:([\s\S]*?)$/i
  };

  for (const [key, pattern] of Object.entries(sectionPatterns)) {
    const match = analysis.match(pattern);
    if (match && match[1]) {
      sections[key as keyof typeof sections] = match[1].trim();
    }
  }

  // If sections couldn't be parsed, put everything in market analysis
  if (Object.values(sections).every(section => !section)) {
    sections.marketAnalysis = analysis;
  }

  return sections;
}

/**
 * Generate industry-specific research queries
 */
export async function generateIndustryQueries(
  keywords: string,
  websiteContent: string
): Promise<string[]> {
  
  if (!process.env.OPENAI_API_KEY) {
    return [];
  }

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
            content: 'You are a research strategist who generates targeted market research queries. Generate 5-7 specific research queries that would provide valuable market intelligence.'
          },
          {
            role: 'user',
            content: `Based on these keywords: "${keywords}" and this website content: "${websiteContent.substring(0, 1000)}", generate specific market research queries that would uncover valuable competitive and customer insights.`
          }
        ],
        temperature: 0.5,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const result = await response.json();
    const queries = result.choices[0]?.message?.content || '';
    
    // Extract queries from response (assuming they're in a list format)
    return queries.split('\n')
      .filter((line: string) => line.trim() && (line.includes('?') || line.match(/^\d+\./)))
      .map((query: string) => query.replace(/^\d+\.\s*/, '').trim())
      .slice(0, 7);

  } catch (error) {
    console.error('Query generation error:', error);
    return [];
  }
}

/**
 * Check if OpenAI research is available
 */
export function isOpenAIResearchAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

/**
 * Get OpenAI research configuration status
 */
export function getOpenAIResearchStatus() {
  return {
    configured: !!process.env.OPENAI_API_KEY,
    available: isOpenAIResearchAvailable(),
    apiKeyLength: process.env.OPENAI_API_KEY?.length || 0
  };
}