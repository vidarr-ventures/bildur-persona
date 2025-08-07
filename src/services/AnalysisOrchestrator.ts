// V2 Orchestration Service - Built from scratch

import { Analysis, AnalysisStatus, CreateAnalysisRequest } from '../domain/entities/Analysis';
import { Report, PersonaData, CustomerQuote } from '../domain/entities/Report';
import { IAnalysisRepository } from '../repositories/AnalysisRepository';
import { IReportRepository } from '../repositories/ReportRepository';
import { WebScrapingService } from './WebScrapingService';
import { AIAnalysisService } from './AIAnalysisService';

export interface AnalysisProgress {
  analysisId: string;
  status: AnalysisStatus;
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
  estimatedTimeRemaining?: number;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export class AnalysisOrchestrator {
  private readonly totalSteps = 6;
  
  constructor(
    private readonly analysisRepo: IAnalysisRepository,
    private readonly reportRepo: IReportRepository,
    private readonly webScraper: WebScrapingService,
    private readonly aiService: AIAnalysisService
  ) {}

  async startAnalysis(request: CreateAnalysisRequest): Promise<string> {
    // Create new analysis record
    const analysis = Analysis.create(request);
    await this.analysisRepo.create(analysis);
    
    // Start processing asynchronously (don't await)
    this.processAnalysisAsync(analysis.id).catch(error => {
      console.error(`Analysis ${analysis.id} failed:`, error);
      this.handleAnalysisError(analysis.id, error);
    });
    
    return analysis.id;
  }

  async getAnalysisProgress(analysisId: string): Promise<AnalysisProgress> {
    const analysis = await this.analysisRepo.findById(analysisId);
    
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    // Calculate progress based on status
    const progressMap = {
      [AnalysisStatus.PENDING]: { completed: 0, current: 'Initializing' },
      [AnalysisStatus.PROCESSING]: { completed: 3, current: 'Processing content' },
      [AnalysisStatus.COMPLETED]: { completed: 6, current: 'Complete' },
      [AnalysisStatus.FAILED]: { completed: 0, current: 'Failed' },
      [AnalysisStatus.CANCELLED]: { completed: 0, current: 'Cancelled' },
    };

    const progress = progressMap[analysis.status];
    const estimatedTimeRemaining = this.calculateEstimatedTime(progress.completed);

    return {
      analysisId,
      status: analysis.status,
      currentStep: progress.current,
      completedSteps: progress.completed,
      totalSteps: this.totalSteps,
      estimatedTimeRemaining,
    };
  }

  async getAnalysisReport(analysisId: string): Promise<Report | null> {
    const analysis = await this.analysisRepo.findById(analysisId);
    
    if (!analysis) {
      throw new Error('Analysis not found');
    }

    if (analysis.status !== AnalysisStatus.COMPLETED) {
      return null;
    }

    const reportEntity = await this.reportRepo.findLatestByAnalysisId(analysisId);
    
    if (!reportEntity) {
      return null;
    }

    return new Report(
      reportEntity.id,
      reportEntity.analysisId,
      reportEntity.version,
      reportEntity.reportType,
      reportEntity.personaData,
      reportEntity.quotes,
      reportEntity.fullReport,
      reportEntity.summary,
      reportEntity.generatedAt
    );
  }

  private async processAnalysisAsync(analysisId: string): Promise<void> {
    let analysis = await this.analysisRepo.findById(analysisId);
    if (!analysis) throw new Error('Analysis not found');

    try {
      // Step 1: Start processing
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.PROCESSING,
        startedAt: new Date()
      });

      // Step 2: Scrape website content
      const scrapedContent = await this.webScraper.scrapeWebsite(analysis.targetUrl);
      
      // Step 3: Extract persona data
      const personaData = await this.aiService.analyzePersonaData(scrapedContent);
      
      // Step 4: Extract customer quotes
      const quotes = await this.aiService.extractCustomerQuotes(scrapedContent);
      
      // Step 5: Generate full report
      const { fullReport, summary } = await this.aiService.generatePersonaReport(
        personaData,
        quotes,
        scrapedContent
      );
      
      // Step 6: Create and save report
      const report = Report.create(
        analysisId,
        personaData,
        quotes,
        fullReport,
        summary
      );
      
      await this.reportRepo.create(report);
      
      // Mark analysis as completed
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.COMPLETED,
        completedAt: new Date()
      });
      
      // Send notification if email provided
      if (analysis.userEmail) {
        await this.sendCompletionNotification(analysis.userEmail, analysisId);
      }
      
    } catch (error) {
      await this.handleAnalysisError(analysisId, error);
      throw error;
    }
  }

  private async handleAnalysisError(analysisId: string, error: unknown): Promise<void> {
    try {
      await this.analysisRepo.update(analysisId, {
        status: AnalysisStatus.FAILED,
        updatedAt: new Date()
      });
    } catch (updateError) {
      console.error('Failed to update analysis error status:', updateError);
    }
  }

  private calculateEstimatedTime(completedSteps: number): number | undefined {
    const averageTimePerStep = 20; // seconds
    const remainingSteps = this.totalSteps - completedSteps;
    
    if (remainingSteps <= 0) return undefined;
    
    return remainingSteps * averageTimePerStep;
  }

  private async sendCompletionNotification(email: string, analysisId: string): Promise<void> {
    // TODO: Implement email notification
    console.log(`Would send completion notification to ${email} for analysis ${analysisId}`);
  }
}