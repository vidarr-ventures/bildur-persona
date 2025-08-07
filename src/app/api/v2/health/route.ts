// V2 API - Built from scratch

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: 'healthy' | 'unhealthy';
      responseTime?: number;
      error?: string;
    };
    openai: {
      status: 'healthy' | 'unhealthy';
      configured: boolean;
      error?: string;
    };
    system: {
      status: 'healthy' | 'unhealthy';
      uptime: number;
      memory: {
        used: number;
        free: number;
        total: number;
      };
    };
  };
}

let prisma: PrismaClient;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  
  try {
    if (!prisma) {
      prisma = new PrismaClient();
    }

    // Test database connectivity
    const dbStartTime = Date.now();
    let dbStatus: HealthStatus['services']['database'];
    
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = {
        status: 'healthy',
        responseTime: Date.now() - dbStartTime,
      };
    } catch (error) {
      dbStatus = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed',
      };
    }

    // Check OpenAI configuration
    const openaiConfigured = !!process.env.OPENAI_API_KEY;
    const openaiStatus: HealthStatus['services']['openai'] = {
      status: openaiConfigured ? 'healthy' : 'unhealthy',
      configured: openaiConfigured,
      error: openaiConfigured ? undefined : 'OPENAI_API_KEY not configured',
    };

    // System information
    const memoryUsage = process.memoryUsage();
    const systemStatus: HealthStatus['services']['system'] = {
      status: 'healthy',
      uptime: process.uptime(),
      memory: {
        used: memoryUsage.heapUsed,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
      },
    };

    // Determine overall status
    const allServices = [dbStatus.status, openaiStatus.status, systemStatus.status];
    let overallStatus: HealthStatus['status'];
    
    if (allServices.every(status => status === 'healthy')) {
      overallStatus = 'healthy';
    } else if (allServices.some(status => status === 'healthy')) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '2.0',
      services: {
        database: dbStatus,
        openai: openaiStatus,
        system: systemStatus,
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthStatus, { status: statusCode });

  } catch (error) {
    console.error('Health check error:', error);
    
    const healthStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0',
      services: {
        database: { status: 'unhealthy', error: 'Health check failed' },
        openai: { status: 'unhealthy', configured: false },
        system: { 
          status: 'unhealthy', 
          uptime: 0, 
          memory: { used: 0, free: 0, total: 0 } 
        },
      },
    };

    return NextResponse.json(healthStatus, { status: 503 });
  }
}

// Handle other methods
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}