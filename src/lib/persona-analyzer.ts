import OpenAI from 'openai';
import { PersonaDatabase } from './db/persona-db';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export interface WebsiteAnalysis {
  demographics: {
    age_range?: string;
    location?: string;
    income?: string;
    occupation?: string;
    education?: string;
  };
  pain_points: string[];
  motivations: string[];
  behaviors: string[];
  preferred_channels: string[];
  values: string[];
  objections: string[];
  decision_factors: string[];
}

export interface RawQuote {
  source: string;
  quote: string;
  context: string;
  relevance?: string;
}

export class PersonaAnalyzer {
  /**
   * Fetch and analyze website content
   */
  static async analyzeWebsite(url: string): Promise<{
    structuredData: WebsiteAnalysis;
    rawQuotes: RawQuote[];
    websiteContent: string;
  }> {
    try {
      // Fetch website content using Firecrawl or fallback
      const websiteContent = await this.fetchWebsiteContent(url);
      
      // Extract structured insights using GPT-4
      const structuredData = await this.extractStructuredData(websiteContent, url);
      
      // Extract relevant quotes
      const rawQuotes = await this.extractQuotes(websiteContent, url);
      
      return {
        structuredData,
        rawQuotes,
        websiteContent
      };
    } catch (error) {
      console.error('Error analyzing website:', error);
      throw new Error(`Failed to analyze website: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch website content
   */
  private static async fetchWebsiteContent(url: string): Promise<string> {
    try {
      // For now, use basic fetch method
      // TODO: Add Firecrawl integration later
      const response = await fetch(url);
      const html = await response.text();
      
      // Basic HTML to text extraction (remove tags)
      const text = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      return text.substring(0, 10000); // Limit content size
    } catch (error) {
      console.error('Error fetching website content:', error);
      throw new Error('Failed to fetch website content');
    }
  }

  /**
   * Extract structured data from website content
   */
  private static async extractStructuredData(content: string, url: string): Promise<WebsiteAnalysis> {
    const prompt = `Analyze this website content and extract structured customer persona insights.

Website URL: ${url}
Content: ${content.substring(0, 8000)}

Extract and structure the following information about the target customer:

1. Demographics (age range, location, income, occupation, education)
2. Pain points and challenges they face
3. Motivations and goals
4. Behaviors and habits
5. Preferred communication channels
6. Core values and beliefs
7. Common objections or concerns
8. Key decision factors

Return the analysis as a JSON object with this structure:
{
  "demographics": {
    "age_range": "string or null",
    "location": "string or null",
    "income": "string or null",
    "occupation": "string or null",
    "education": "string or null"
  },
  "pain_points": ["array of strings"],
  "motivations": ["array of strings"],
  "behaviors": ["array of strings"],
  "preferred_channels": ["array of strings"],
  "values": ["array of strings"],
  "objections": ["array of strings"],
  "decision_factors": ["array of strings"]
}

Be specific and extract actual insights from the content. If information is not available, use empty arrays or null values.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert market researcher and customer persona analyst.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      });

      const result = response.choices[0].message.content;
      if (!result) {
        throw new Error('No response from OpenAI');
      }

      return JSON.parse(result) as WebsiteAnalysis;
    } catch (error) {
      console.error('Error extracting structured data:', error);
      // Return default structure on error
      return {
        demographics: {},
        pain_points: [],
        motivations: [],
        behaviors: [],
        preferred_channels: [],
        values: [],
        objections: [],
        decision_factors: []
      };
    }
  }

  /**
   * Extract relevant quotes from website content
   */
  private static async extractQuotes(content: string, url: string): Promise<RawQuote[]> {
    const prompt = `Extract relevant customer testimonials, reviews, and quotes from this website content.

Website URL: ${url}
Content: ${content.substring(0, 8000)}

Find and extract:
1. Customer testimonials
2. User reviews
3. Case study quotes
4. Success stories
5. Pain point descriptions
6. Value propositions mentioned by customers

Return as a JSON array of quote objects:
[
  {
    "source": "where the quote came from (e.g., 'testimonial section', 'review', 'case study')",
    "quote": "the exact quote or relevant text",
    "context": "brief context about what the quote relates to",
    "relevance": "why this quote is important for understanding the customer"
  }
]

Extract up to 10 most relevant quotes. If no quotes are found, return an empty array.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are an expert at extracting customer insights and testimonials from website content.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      });

      const result = response.choices[0].message.content;
      if (!result) {
        return [];
      }

      const parsed = JSON.parse(result);
      return Array.isArray(parsed) ? parsed : (parsed.quotes || []);
    } catch (error) {
      console.error('Error extracting quotes:', error);
      return [];
    }
  }

  /**
   * Generate comprehensive persona report
   */
  static async generatePersonaReport(
    structuredData: WebsiteAnalysis,
    rawQuotes: RawQuote[],
    url: string,
    customPrompt?: string
  ): Promise<string> {
    // Use custom prompt if provided, otherwise use default
    const systemPrompt = customPrompt || `You are an expert customer persona analyst. Create a comprehensive, actionable customer persona report based on the provided data.`;
    
    const userPrompt = `Create a detailed customer persona report based on this analysis:

Website Analyzed: ${url}

Structured Data:
${JSON.stringify(structuredData, null, 2)}

Customer Quotes and Testimonials:
${JSON.stringify(rawQuotes, null, 2)}

Generate a comprehensive persona report that includes:

1. Executive Summary
2. Demographic Profile
3. Psychographic Analysis
4. Pain Points & Challenges
5. Goals & Motivations
6. Behavioral Patterns
7. Communication Preferences
8. Decision-Making Process
9. Objections & Concerns
10. Marketing Recommendations
11. Product/Service Alignment
12. Actionable Next Steps

Make the report specific, actionable, and based on the actual data provided. Use quotes where relevant to support insights.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 4000,
      });

      const report = response.choices[0].message.content;
      if (!report) {
        throw new Error('No report generated');
      }

      return report;
    } catch (error) {
      console.error('Error generating persona report:', error);
      throw new Error('Failed to generate persona report');
    }
  }

  /**
   * Complete analysis pipeline
   */
  static async runCompleteAnalysis(
    url: string,
    userEmail?: string,
    customPrompt?: string
  ): Promise<{
    analysisId: string;
    report: string;
    structuredData: WebsiteAnalysis;
    rawQuotes: RawQuote[];
  }> {
    // Create database record
    const analysis = await PersonaDatabase.createAnalysis(url, userEmail);
    
    try {
      // Analyze website
      const { structuredData, rawQuotes } = await this.analyzeWebsite(url);
      
      // Update database with structured data
      await PersonaDatabase.updateStructuredData(
        analysis.analysis_id,
        structuredData,
        rawQuotes
      );
      
      // Generate persona report
      const report = await this.generatePersonaReport(
        structuredData,
        rawQuotes,
        url,
        customPrompt
      );
      
      // Update database with final report
      await PersonaDatabase.updatePersonaReport(analysis.analysis_id, report);
      
      return {
        analysisId: analysis.analysis_id,
        report,
        structuredData,
        rawQuotes
      };
    } catch (error) {
      // Mark as failed in database
      await PersonaDatabase.markFailed(
        analysis.analysis_id,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }
}