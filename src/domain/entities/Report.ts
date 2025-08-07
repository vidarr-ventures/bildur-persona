// V2 Domain Entity - Built from scratch

export enum ReportType {
  FULL = 'FULL',
  SUMMARY = 'SUMMARY',
  CUSTOM = 'CUSTOM'
}

export interface PersonaData {
  demographics: {
    ageRange?: string;
    location?: string;
    income?: string;
    occupation?: string;
    education?: string;
  };
  painPoints: string[];
  motivations: string[];
  behaviors: string[];
  preferredChannels: string[];
  values: string[];
  objections: string[];
  decisionFactors: string[];
}

export interface CustomerQuote {
  text: string;
  source: string;
  context: string;
  relevance: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface ReportEntity {
  readonly id: string;
  readonly analysisId: string;
  readonly version: number;
  readonly reportType: ReportType;
  readonly personaData: PersonaData;
  readonly quotes: CustomerQuote[];
  readonly fullReport: string;
  readonly summary: string;
  readonly generatedAt: Date;
}

export class Report {
  constructor(
    public readonly id: string,
    public readonly analysisId: string,
    public readonly version: number,
    public readonly reportType: ReportType,
    public readonly personaData: PersonaData,
    public readonly quotes: CustomerQuote[],
    public readonly fullReport: string,
    public readonly summary: string,
    public readonly generatedAt: Date = new Date()
  ) {
    this.validatePersonaData(personaData);
    this.validateReportContent(fullReport, summary);
  }

  static create(
    analysisId: string,
    personaData: PersonaData,
    quotes: CustomerQuote[],
    fullReport: string,
    summary: string,
    reportType: ReportType = ReportType.FULL,
    version: number = 1
  ): Report {
    return new Report(
      generateReportId(),
      analysisId,
      version,
      reportType,
      personaData,
      quotes,
      fullReport,
      summary
    );
  }

  getPersonaSummary(): string {
    const { demographics, painPoints, motivations } = this.personaData;
    
    let summary = 'Customer Persona Summary:\n\n';
    
    if (demographics.ageRange || demographics.location || demographics.occupation) {
      summary += 'Demographics: ';
      const demo = [
        demographics.ageRange,
        demographics.occupation,
        demographics.location
      ].filter(Boolean).join(', ');
      summary += demo + '\n\n';
    }
    
    if (painPoints.length > 0) {
      summary += `Top Pain Points: ${painPoints.slice(0, 3).join(', ')}\n\n`;
    }
    
    if (motivations.length > 0) {
      summary += `Key Motivations: ${motivations.slice(0, 3).join(', ')}\n`;
    }
    
    return summary;
  }

  getTopQuotes(limit: number = 5): CustomerQuote[] {
    return this.quotes
      .sort((a, b) => this.scoreQuote(b) - this.scoreQuote(a))
      .slice(0, limit);
  }

  hasValidContent(): boolean {
    return this.fullReport.length > 100 && 
           this.summary.length > 50 &&
           (this.personaData.painPoints.length > 0 || 
            this.personaData.motivations.length > 0);
  }

  getInsightCount(): number {
    const { painPoints, motivations, behaviors, values, objections, decisionFactors } = this.personaData;
    return painPoints.length + motivations.length + behaviors.length + 
           values.length + objections.length + decisionFactors.length;
  }

  private validatePersonaData(data: PersonaData): void {
    if (!data) {
      throw new Error('Persona data is required');
    }
    
    // Ensure arrays are initialized
    data.painPoints = data.painPoints || [];
    data.motivations = data.motivations || [];
    data.behaviors = data.behaviors || [];
    data.preferredChannels = data.preferredChannels || [];
    data.values = data.values || [];
    data.objections = data.objections || [];
    data.decisionFactors = data.decisionFactors || [];
  }

  private validateReportContent(fullReport: string, summary: string): void {
    if (!fullReport || fullReport.trim().length < 50) {
      throw new Error('Full report content is too short');
    }
    
    if (!summary || summary.trim().length < 20) {
      throw new Error('Summary content is too short');
    }
  }

  private scoreQuote(quote: CustomerQuote): number {
    let score = 0;
    
    // Length factor (prefer substantial quotes)
    score += Math.min(quote.text.length / 10, 20);
    
    // Sentiment factor (prefer positive and negative over neutral)
    if (quote.sentiment !== 'neutral') score += 10;
    
    // Relevance keywords
    const relevanceKeywords = ['problem', 'solution', 'love', 'hate', 'need', 'want', 'frustrat'];
    const hasRelevance = relevanceKeywords.some(keyword => 
      quote.text.toLowerCase().includes(keyword)
    );
    if (hasRelevance) score += 15;
    
    return score;
  }
}

function generateReportId(): string {
  return `rpt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}