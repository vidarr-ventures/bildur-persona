// V2 Debug API - Get debug data for analysis

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { AnalysisRepository } from '../../../../../repositories/AnalysisRepository';
import { ReportRepository } from '../../../../../repositories/ReportRepository';
import { WebScrapingService } from '../../../../../services/WebScrapingService';
import { AIAnalysisService } from '../../../../../services/AIAnalysisService';
import { DebugAnalysisOrchestrator } from '../../../../../services/DebugAnalysisOrchestrator';

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
let debugOrchestrator: DebugAnalysisOrchestrator;

function initializeServices() {
  if (!prisma) {
    prisma = new PrismaClient();
  }
  
  if (!debugOrchestrator) {
    const analysisRepo = new AnalysisRepository(prisma);
    const reportRepo = new ReportRepository(prisma);
    const webScraper = new WebScrapingService();
    
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    const aiService = new AIAnalysisService(openaiApiKey);
    
    debugOrchestrator = new DebugAnalysisOrchestrator(
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
    
    // Get debug data
    const debugData = await debugOrchestrator.getDebugData(id);
    
    // Format response
    const responseData = {
      analysisId: debugData.analysisId,
      status: debugData.status,
      totalDuration: `${(debugData.totalDuration / 1000).toFixed(2)}s`,
      errorCount: debugData.errors.length,
      steps: debugData.steps.map(step => ({
        name: step.stepName,
        order: step.stepOrder,
        status: step.status,
        duration: step.duration ? `${(step.duration / 1000).toFixed(2)}s` : null,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
        hasError: !!step.errorInfo,
        error: step.errorInfo,
        input: step.input,
        output: step.output,
        debug: step.debugData
      })),
      report: debugData.report ? {
        id: debugData.report.id,
        fullReport: debugData.report.fullReport,
        summary: debugData.report.summary,
        personaData: debugData.report.personaData,
        quotes: debugData.report.quotes,
        insightCount: debugData.report.getInsightCount(),
        topQuotes: debugData.report.getTopQuotes(3),
        reportValid: debugData.report.hasValidContent()
      } : null,
      errors: debugData.errors
    };
    
    const response: ApiResponse = {
      success: true,
      data: responseData,
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '2.0-debug',
      },
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Get debug data error:', error);
    
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('not found')) {
        errorCode = 'ANALYSIS_NOT_FOUND';
        statusCode = 404;
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
        version: '2.0-debug',
      },
    };
    
    return NextResponse.json(response, { status: statusCode });
  }
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}