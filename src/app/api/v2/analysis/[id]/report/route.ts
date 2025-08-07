// V2 API - Built from scratch

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AnalysisRepository } from '../../../../../../repositories/AnalysisRepository';
import { ReportRepository } from '../../../../../../repositories/ReportRepository';
import { WebScrapingService } from '../../../../../../services/WebScrapingService';
import { AIAnalysisService } from '../../../../../../services/AIAnalysisService';
import { AnalysisOrchestrator } from '../../../../../../services/AnalysisOrchestrator';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

let prisma: PrismaClient;
let orchestrator: AnalysisOrchestrator;

function initializeServices() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  
  if (!orchestrator) {
    const analysisRepo = new AnalysisRepository(prisma);
    const reportRepo = new ReportRepository(prisma);
    const webScraper = new WebScrapingService();
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    const aiService = new AIAnalysisService(openaiApiKey);
    
    orchestrator = new AnalysisOrchestrator(
      analysisRepo,
      reportRepo,
      webScraper,
      aiService
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    const { id } = await params;
    
    if (!id) {
      throw new Error('Analysis ID is required');
    }
    
    initializeServices();
    
    // Get analysis report
    const report = await orchestrator.getAnalysisReport(id);
    
    if (!report) {
      const response: ApiResponse = {
        success: false,
        error: {
          code: 'REPORT_NOT_READY',
          message: 'Report is not ready yet. Analysis may still be processing.',
        },
        metadata: {
          requestId,
          timestamp: new Date().toISOString(),
          version: '2.0',
        },
      };
      
      return NextResponse.json(response, { status: 404 });
    }
    
    // Transform report for API response
    const reportData = {
      id: report.id,
      analysisId: report.analysisId,
      version: report.version,
      reportType: report.reportType,
      personaData: {
        demographics: report.personaData.demographics,
        painPoints: report.personaData.painPoints,
        motivations: report.personaData.motivations,
        behaviors: report.personaData.behaviors,
        preferredChannels: report.personaData.preferredChannels,
        values: report.personaData.values,
        objections: report.personaData.objections,
        decisionFactors: report.personaData.decisionFactors,
      },
      quotes: report.quotes,
      fullReport: report.fullReport,
      summary: report.summary,
      generatedAt: report.generatedAt,
      stats: {
        insightCount: report.getInsightCount(),
        topQuotes: report.getTopQuotes(3),
        hasValidContent: report.hasValidContent(),
      },
    };
    
    const response: ApiResponse = {
      success: true,
      data: reportData,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '2.0',
      },
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Get report error:', error);
    
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('not found')) {
        errorCode = 'ANALYSIS_NOT_FOUND';
        statusCode = 404;
      } else if (error.message.includes('required')) {
        errorCode = 'VALIDATION_ERROR';
        statusCode = 400;
      }
    }
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '2.0',
      },
    };
    
    return NextResponse.json(response, { status: statusCode });
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}