// V2 Debug Analysis Orchestrator - Enhanced with step tracking

import { Analysis, AnalysisStatus, CreateAnalysisRequest } from '../domain/entities/Analysis';
import { Report, PersonaData, CustomerQuote } from '../domain/entities/Report';
import { IAnalysisRepository } from '../repositories/AnalysisRepository';
import { IReportRepository } from '../repositories/ReportRepository';
import { WebScrapingService, ScrapedContent } from './WebScrapingService';
import { AIAnalysisService } from './AIAnalysisService';
import { PrismaClient } from '@prisma/client';

export interface ProcessingStep {
  stepName: string;
  stepOrder: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  input?: any;
  output?: any;
  errorInfo?: any;
  debugData?: {
    dataSize?: number;
    tokenCount?: number;
    apiCalls?: number;
    retryCount?: number;
    warnings?: string[];
    [key: string]: any;
  };
}

export interface DebugAnalysisResult {
  analysisId: string;
  status: AnalysisStatus;
  steps: ProcessingStep[];
  report?: Report;
  totalDuration: number;
  errors: any[];
}

export class DebugAnalysisOrchestrator {
  private readonly prisma: PrismaClient;
  private readonly debugStorage = new Map<string, ProcessingStep[]>();
  private readonly steps = [
    'URL_VALIDATION',
    'WEBSITE_SCRAPING',
    'CONTENT_PROCESSING',
    'PERSONA_EXTRACTION',
    'QUOTE_EXTRACTION',
    'REPORT_GENERATION',
    'FINALIZATION'
  ];
  
  constructor(
    private readonly analysisRepo: IAnalysisRepository,
    private readonly reportRepo: IReportRepository,
    private readonly webScraper: WebScrapingService,
    private readonly aiService: AIAnalysisService
  ) {
    this.prisma = new PrismaClient();
  }

  async startDebugAnalysis(request: CreateAnalysisRequest): Promise<string> {
    // Create new analysis record
    const analysis = Analysis.create(request);
    await this.analysisRepo.create(analysis);
    
    // Initialize all steps in database
    await this.initializeSteps(analysis.id);
    
    // Start processing asynchronously
    this.processAnalysisWithDebug(analysis.id).catch(error => {
      console.error(`Debug analysis ${analysis.id} failed:`, error);
      this.handleAnalysisError(analysis.id, error);
    });
    
    return analysis.id;
  }

  async getDebugData(analysisId: string): Promise<DebugAnalysisResult> {
    const analysis = await this.analysisRepo.findById(analysisId);
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // Get steps from in-memory storage
    const steps = this.debugStorage.get(analysisId) || [];

    // Get report if completed
    let report: Report | undefined;
    if (analysis.status === AnalysisStatus.COMPLETED) {
      const reportData = await this.reportRepo.findLatestByAnalysisId(analysisId);
      if (reportData) {
        report = new Report(
          reportData.id,
          reportData.analysisId,
          reportData.version,
          reportData.reportType,
          reportData.personaData,
          reportData.quotes,
          reportData.fullReport,
          reportData.summary,
          reportData.generatedAt
        );
      }
    }

    // Calculate total duration
    const totalDuration = steps.reduce((sum, step) => 
      sum + (step.duration || 0), 0
    );

    // Collect errors
    const errors = steps
      .filter(step => step.errorInfo)
      .map(step => ({
        step: step.stepName,
        error: step.errorInfo
      }));

    return {
      analysisId,
      status: analysis.status,
      steps,
      report,
      totalDuration,
      errors
    };
  }

  private async initializeSteps(analysisId: string): Promise<void> {
    const steps: ProcessingStep[] = this.steps.map((stepName, index) => ({
      stepName,
      stepOrder: index + 1,
      status: 'pending' as const,
      startedAt: undefined,
      completedAt: undefined,
      duration: undefined,
      input: undefined,
      output: undefined,
      errorInfo: undefined,
      debugData: undefined
    }));
    
    this.debugStorage.set(analysisId, steps);
  }

  private async processAnalysisWithDebug(analysisId: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update analysis to processing
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.PROCESSING,
        startedAt: new Date()
      });

      // Step 1: URL Validation
      await this.executeStep(analysisId, 'URL_VALIDATION', async () => {
        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) throw new Error('Analysis not found');
        
        const url = new URL(analysis.targetUrl);
        return {
          input: { url: analysis.targetUrl },
          output: { 
            valid: true, 
            protocol: url.protocol,
            hostname: url.hostname,
            pathname: url.pathname
          },
          debugData: {
            urlLength: analysis.targetUrl.length,
            hasWww: url.hostname.startsWith('www.'),
            isHttps: url.protocol === 'https:'
          }
        };
      });

      // Step 2: Website Scraping
      let scrapedContent: ScrapedContent;
      await this.executeStep(analysisId, 'WEBSITE_SCRAPING', async () => {
        const analysis = await this.analysisRepo.findById(analysisId);
        if (!analysis) throw new Error('Analysis not found');
        
        scrapedContent = await this.webScraper.scrapeWebsite(analysis.targetUrl);
        
        return {
          input: { url: analysis.targetUrl },
          output: {
            title: scrapedContent.title,
            contentLength: scrapedContent.content.length,
            metadata: scrapedContent.metadata
          },
          debugData: {
            dataSize: scrapedContent.content.length,
            loadTime: scrapedContent.performance.loadTime,
            hasDescription: !!scrapedContent.metadata.description,
            hasKeywords: !!(scrapedContent.metadata.keywords?.length),
            language: scrapedContent.metadata.language
          }
        };
      });

      // Step 3: Content Processing
      await this.executeStep(analysisId, 'CONTENT_PROCESSING', async () => {
        const processedContent = {
          wordCount: scrapedContent!.content.split(/\s+/).length,
          sentences: scrapedContent!.content.split(/[.!?]+/).length,
          hasTestimonials: scrapedContent!.content.toLowerCase().includes('testimonial'),
          hasReviews: scrapedContent!.content.toLowerCase().includes('review'),
          hasPricing: scrapedContent!.content.toLowerCase().includes('price')
        };
        
        return {
          input: { contentLength: scrapedContent!.content.length },
          output: processedContent,
          debugData: {
            dataSize: scrapedContent!.content.length,
            wordCount: processedContent.wordCount,
            sentenceCount: processedContent.sentences,
            indicators: {
              testimonials: processedContent.hasTestimonials,
              reviews: processedContent.hasReviews,
              pricing: processedContent.hasPricing
            }
          }
        };
      });

      // Step 4: Persona Extraction
      let personaData: PersonaData;
      await this.executeStep(analysisId, 'PERSONA_EXTRACTION', async () => {
        personaData = await this.aiService.analyzePersonaData(scrapedContent!);
        
        const insightCount = 
          personaData.painPoints.length +
          personaData.motivations.length +
          personaData.behaviors.length +
          personaData.values.length;
        
        return {
          input: { 
            contentLength: scrapedContent!.content.length,
            url: scrapedContent!.url
          },
          output: {
            demographics: personaData.demographics,
            insightCount,
            painPointCount: personaData.painPoints.length,
            motivationCount: personaData.motivations.length
          },
          debugData: {
            totalInsights: insightCount,
            hasDemographics: !!personaData.demographics.ageRange,
            categoriesFound: Object.keys(personaData).filter(
              key => Array.isArray(personaData[key as keyof PersonaData]) && 
                     (personaData[key as keyof PersonaData] as any[]).length > 0
            )
          }
        };
      });

      // Step 5: Quote Extraction
      let quotes: CustomerQuote[];
      await this.executeStep(analysisId, 'QUOTE_EXTRACTION', async () => {
        quotes = await this.aiService.extractCustomerQuotes(scrapedContent!);
        
        const sentimentCounts = quotes.reduce((acc, quote) => {
          acc[quote.sentiment] = (acc[quote.sentiment] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return {
          input: { contentLength: scrapedContent!.content.length },
          output: {
            quoteCount: quotes.length,
            sentiments: sentimentCounts
          },
          debugData: {
            totalQuotes: quotes.length,
            averageQuoteLength: quotes.length > 0 
              ? Math.round(quotes.reduce((sum, q) => sum + q.text.length, 0) / quotes.length)
              : 0,
            sourcesFound: [...new Set(quotes.map(q => q.source))],
            sentimentDistribution: sentimentCounts
          }
        };
      });

      // Step 6: Report Generation
      let fullReport: string;
      let summary: string;
      await this.executeStep(analysisId, 'REPORT_GENERATION', async () => {
        const reportResult = await this.aiService.generatePersonaReport(
          personaData!,
          quotes!,
          scrapedContent!
        );
        
        fullReport = reportResult.fullReport;
        summary = reportResult.summary;
        
        return {
          input: {
            personaInsights: Object.keys(personaData!).length,
            quoteCount: quotes!.length
          },
          output: {
            reportLength: fullReport.length,
            summaryLength: summary.length,
            sections: fullReport.split(/\n##\s+/).length - 1
          },
          debugData: {
            reportSize: fullReport.length,
            summarySize: summary.length,
            wordCount: fullReport.split(/\s+/).length,
            hasActionableInsights: fullReport.toLowerCase().includes('recommend'),
            sectionCount: fullReport.split(/\n##\s+/).length - 1
          }
        };
      });

      // Step 7: Finalization
      await this.executeStep(analysisId, 'FINALIZATION', async () => {
        const report = Report.create(
          analysisId,
          personaData!,
          quotes!,
          fullReport!,
          summary!
        );
        
        await this.reportRepo.create(report);
        
        return {
          input: { analysisId },
          output: { 
            reportId: report.id,
            version: report.version,
            insightCount: report.getInsightCount()
          },
          debugData: {
            totalDuration: Date.now() - startTime,
            reportValid: report.hasValidContent(),
            topQuotes: report.getTopQuotes(3).length
          }
        };
      });

      // Mark analysis as completed
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.COMPLETED,
        completedAt: new Date()
      });
      
    } catch (error) {
      await this.handleAnalysisError(analysisId, error);
      throw error;
    }
  }

  private async executeStep(
    analysisId: string,
    stepName: string,
    execution: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    
    // Update step to in_progress in memory
    this.updateStepInMemory(analysisId, stepName, {
      status: 'in_progress',
      startedAt: new Date()
    });

    try {
      const result = await execution();
      const duration = Date.now() - startTime;
      
      // Update step with results in memory
      this.updateStepInMemory(analysisId, stepName, {
        status: 'completed',
        completedAt: new Date(),
        duration,
        input: result.input || {},
        output: result.output || {},
        debugData: result.debugData || {}
      });
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update step with error in memory
      this.updateStepInMemory(analysisId, stepName, {
        status: 'failed',
        completedAt: new Date(),
        duration,
        errorInfo: {
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }

  private updateStepInMemory(
    analysisId: string, 
    stepName: string, 
    updates: Partial<ProcessingStep>
  ): void {
    const steps = this.debugStorage.get(analysisId) || [];
    const stepIndex = steps.findIndex(step => step.stepName === stepName);
    
    if (stepIndex >= 0) {
      steps[stepIndex] = { ...steps[stepIndex], ...updates };
      this.debugStorage.set(analysisId, steps);
    }
  }

  private async handleAnalysisError(analysisId: string, error: unknown): Promise<void> {
    try {
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.FAILED,
        updatedAt: new Date()
      });
      
      // Mark remaining steps as skipped in memory
      const steps = this.debugStorage.get(analysisId) || [];
      steps.forEach(step => {
        if (step.status === 'pending') {
          step.status = 'skipped';
        }
      });
      this.debugStorage.set(analysisId, steps);
    } catch (updateError) {
      console.error('Failed to update analysis error status:', updateError);
    }
  }

}