// V2 API - Built from scratch

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { AnalysisRepository } from '../../../../../repositories/AnalysisRepository';
import { ReportRepository } from '../../../../../repositories/ReportRepository';
import { WebScrapingService } from '../../../../../services/WebScrapingService';
import { AIAnalysisService } from '../../../../../services/AIAnalysisService';
import { AnalysisOrchestrator } from '../../../../../services/AnalysisOrchestrator';
import { DebugAnalysisOrchestrator } from '../../../../../services/DebugAnalysisOrchestrator';

// Request validation schema
const startAnalysisSchema = z.object({
  targetUrl: z.string().url('Invalid URL format'),
  userEmail: z.string().email().optional(),
  debugMode: z.boolean().optional(),
});

// Response types
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
let debugOrchestrator: DebugAnalysisOrchestrator;

// Initialize services
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
    
    debugOrchestrator = new DebugAnalysisOrchestrator(
      analysisRepo,
      reportRepo,
      webScraper,
      aiService
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const requestId = generateRequestId();
  
  try {
    // Parse and validate request
    const body = await request.json();
    const validatedData = startAnalysisSchema.parse(body);
    
    // Initialize services
    initializeServices();
    
    // Process analysis synchronously (direct approach)
    console.log('[API] Starting synchronous analysis processing...');
    
    const analysisResult = validatedData.debugMode
      ? await debugOrchestrator.processAnalysisSync({
          targetUrl: validatedData.targetUrl,
          userEmail: validatedData.userEmail,
        })
      : await orchestrator.processAnalysisSync({
          targetUrl: validatedData.targetUrl,
          userEmail: validatedData.userEmail,
        });
    
    console.log(`[API] Analysis completed: ${analysisResult.analysisId}, status: ${analysisResult.status}`);
    
    const response: ApiResponse = {
      success: true,
      data: {
        analysisId: analysisResult.analysisId,
        status: analysisResult.status,
        message: analysisResult.status === 'COMPLETED' 
          ? 'Analysis completed successfully' 
          : 'Analysis completed with issues',
        processingTime: analysisResult.duration ? `${Math.round(analysisResult.duration / 1000)}s` : undefined,
        reportUrl: analysisResult.status === 'COMPLETED' 
          ? `/api/v2/analysis/${analysisResult.analysisId}/report` 
          : undefined
      },
      metadata: {
        requestId,
        timestamp: new Date().toISOString(),
        version: '2.0',
      },
    };
    
    return NextResponse.json(response, { status: analysisResult.status === 'COMPLETED' ? 200 : 206 });
    
  } catch (error) {
    console.error('Analysis start error:', error);
    
    let errorCode = 'INTERNAL_ERROR';
    let errorMessage = 'Internal server error';
    let statusCode = 500;
    
    if (error instanceof z.ZodError) {
      errorCode = 'VALIDATION_ERROR';
      errorMessage = 'Invalid request data';
      statusCode = 400;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('URL')) {
        errorCode = 'INVALID_URL';
        statusCode = 400;
      } else if (error.message.includes('OPENAI_API_KEY')) {
        errorCode = 'CONFIGURATION_ERROR';
        statusCode = 503;
      }
    }
    
    const response: ApiResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
        details: error instanceof z.ZodError ? error.errors : undefined,
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

export async function GET(): Promise<NextResponse> {
  const response: ApiResponse = {
    success: true,
    data: {
      endpoint: 'Start Analysis',
      method: 'POST',
      description: 'Initialize a new customer persona analysis',
      parameters: {
        targetUrl: 'string (required) - Website URL to analyze',
        userEmail: 'string (optional) - Email for completion notification',
      },
      example: {
        targetUrl: 'https://example.com',
        userEmail: 'user@example.com',
      },
    },
    metadata: {
      requestId: generateRequestId(),
      timestamp: new Date().toISOString(),
      version: '2.0',
    },
  };
  
  return NextResponse.json(response);
}

function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}