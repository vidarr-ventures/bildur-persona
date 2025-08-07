// V2 Service - Built from scratch

import OpenAI from 'openai';
import { PersonaData, CustomerQuote } from '../domain/entities/Report';
import { ScrapedContent } from './WebScrapingService';

export interface AIAnalysisRequest {
  websiteContent: ScrapedContent;
  analysisType: 'full' | 'demographics' | 'pain_points' | 'motivations' | 'behaviors' | 'quotes';
  customPrompt?: string;
}

export interface AIAnalysisResult {
  analysisType: string;
  result: any;
  tokensUsed: number;
  duration: number;
  model: string;
  cost: number;
}

export class AIAnalysisService {
  private readonly openai: OpenAI;
  private readonly model = 'gpt-4o';
  private readonly maxTokens = 4000;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzePersonaData(content: ScrapedContent): Promise<PersonaData> {
    const prompt = this.buildPersonaAnalysisPrompt(content);
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert customer persona analyst. Extract detailed customer insights from website content and return structured JSON data.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: this.maxTokens,
      });

      const duration = Date.now() - startTime;
      const result = JSON.parse(response.choices[0].message.content || '{}');

      return this.validateAndNormalizePersonaData(result);
      
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractCustomerQuotes(content: ScrapedContent): Promise<CustomerQuote[]> {
    const prompt = this.buildQuoteExtractionPrompt(content);
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert at extracting customer testimonials and meaningful quotes from website content. Focus on authentic customer voices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2000,
      });

      const duration = Date.now() - startTime;
      const result = JSON.parse(response.choices[0].message.content || '{"quotes": []}');

      return this.validateAndNormalizeQuotes(result.quotes || []);
      
    } catch (error) {
      throw new Error(`Quote extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generatePersonaReport(
    personaData: PersonaData, 
    quotes: CustomerQuote[], 
    content: ScrapedContent,
    customPrompt?: string
  ): Promise<{ fullReport: string; summary: string }> {
    const prompt = customPrompt || this.buildReportGenerationPrompt(personaData, quotes, content);
    const startTime = Date.now();

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: 'You are a world-class customer persona expert. Generate comprehensive, actionable persona reports based on data analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 4000,
      });

      const fullReport = response.choices[0].message.content || 'Report generation failed';
      const summary = this.generateSummaryFromReport(fullReport);

      return { fullReport, summary };
      
    } catch (error) {
      throw new Error(`Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private buildPersonaAnalysisPrompt(content: ScrapedContent): string {
    const websiteText = content.content.substring(0, 8000); // Limit for token efficiency
    
    return `Analyze this website content and extract detailed customer persona insights:

WEBSITE: ${content.url}
TITLE: ${content.title}
CONTENT: ${websiteText}

Extract and structure the following customer persona information as JSON:

{
  "demographics": {
    "ageRange": "estimated age range of target customers",
    "location": "geographic location/market",
    "income": "income level or range", 
    "occupation": "typical job roles or industries",
    "education": "education level"
  },
  "painPoints": ["list of customer problems and frustrations"],
  "motivations": ["list of customer goals and desires"],
  "behaviors": ["list of customer behaviors and habits"],
  "preferredChannels": ["list of communication/marketing channels"],
  "values": ["list of customer values and beliefs"],
  "objections": ["list of common concerns or hesitations"],
  "decisionFactors": ["list of factors that influence purchase decisions"]
}

Base your analysis on:
1. Explicit statements about target customers
2. Product/service positioning and messaging
3. Pricing and value propositions
4. Content tone and style
5. Testimonials or case studies mentioned
6. Industry context and market indicators

Be specific and actionable. Use null for missing information rather than generic statements.`;
  }

  private buildQuoteExtractionPrompt(content: ScrapedContent): string {
    const websiteText = content.content.substring(0, 8000);
    
    return `Extract customer testimonials, reviews, and meaningful quotes from this website content:

WEBSITE: ${content.url}
CONTENT: ${websiteText}

Find and extract quotes that represent authentic customer voices, including:
- Customer testimonials
- User reviews
- Case study quotes
- Success stories
- Problem statements from customers
- Value propositions as stated by customers

Return as JSON:

{
  "quotes": [
    {
      "text": "exact quote text",
      "source": "where the quote came from (testimonial, review, case study, etc.)",
      "context": "context about the quote",
      "relevance": "why this quote is important for understanding the customer",
      "sentiment": "positive|negative|neutral"
    }
  ]
}

Only include quotes that:
1. Represent authentic customer voices (not marketing copy)
2. Provide insights into customer needs, problems, or experiences
3. Are substantial enough to be meaningful (avoid single words)
4. Help understand the target customer persona

Return empty array if no authentic customer quotes are found.`;
  }

  private buildReportGenerationPrompt(
    personaData: PersonaData,
    quotes: CustomerQuote[],
    content: ScrapedContent
  ): string {
    return `Create a comprehensive customer persona report based on this analysis:

WEBSITE ANALYZED: ${content.url}

PERSONA DATA:
${JSON.stringify(personaData, null, 2)}

CUSTOMER QUOTES:
${JSON.stringify(quotes, null, 2)}

Generate a detailed customer persona report that includes:

1. **Executive Summary** - Key findings and persona overview
2. **Demographic Profile** - Age, location, income, occupation, education
3. **Psychographic Analysis** - Values, attitudes, lifestyle, personality
4. **Pain Points & Challenges** - Problems they face, frustrations, barriers
5. **Goals & Motivations** - What they want to achieve, desires, aspirations
6. **Behavioral Patterns** - How they act, decision-making process, habits
7. **Communication Preferences** - Preferred channels, messaging style, tone
8. **Buying Journey** - How they discover, evaluate, and purchase
9. **Objections & Concerns** - What holds them back, common hesitations
10. **Marketing Recommendations** - Specific tactics and messaging strategies

Use the customer quotes throughout the report to support insights and make the persona feel real and authentic.

Make the report actionable with specific recommendations for marketing, product development, and customer engagement.

Format the report in clear, readable sections with headers and bullet points where appropriate.`;
  }

  private generateSummaryFromReport(fullReport: string): string {
    // Extract key points for summary (first 300 words approximately)
    const sentences = fullReport.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const summary = sentences.slice(0, 8).join('. ').trim();
    
    return summary.length > 50 ? summary + '.' : 'See full report for detailed customer persona analysis.';
  }

  private validateAndNormalizePersonaData(data: any): PersonaData {
    return {
      demographics: {
        ageRange: data.demographics?.ageRange || undefined,
        location: data.demographics?.location || undefined,
        income: data.demographics?.income || undefined,
        occupation: data.demographics?.occupation || undefined,
        education: data.demographics?.education || undefined,
      },
      painPoints: Array.isArray(data.painPoints) ? data.painPoints : [],
      motivations: Array.isArray(data.motivations) ? data.motivations : [],
      behaviors: Array.isArray(data.behaviors) ? data.behaviors : [],
      preferredChannels: Array.isArray(data.preferredChannels) ? data.preferredChannels : [],
      values: Array.isArray(data.values) ? data.values : [],
      objections: Array.isArray(data.objections) ? data.objections : [],
      decisionFactors: Array.isArray(data.decisionFactors) ? data.decisionFactors : [],
    };
  }

  private validateAndNormalizeQuotes(quotes: any[]): CustomerQuote[] {
    if (!Array.isArray(quotes)) return [];
    
    return quotes
      .filter(quote => quote.text && typeof quote.text === 'string' && quote.text.length > 10)
      .map(quote => ({
        text: quote.text,
        source: quote.source || 'website',
        context: quote.context || '',
        relevance: quote.relevance || '',
        sentiment: ['positive', 'negative', 'neutral'].includes(quote.sentiment) 
          ? quote.sentiment 
          : 'neutral'
      }))
      .slice(0, 20); // Limit to 20 quotes max
  }
}