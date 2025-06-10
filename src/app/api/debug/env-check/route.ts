// Create: src/app/api/debug/env-check/route.ts

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if environment variables are present (without exposing the actual values)
    const envCheck = {
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      SCRAPEOWL_API_KEY: !!process.env.SCRAPEOWL_API_KEY,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'not set',
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV || 'not set',
      // Show first few characters to verify the key is loaded
      OPENAI_API_KEY_PREFIX: process.env.OPENAI_API_KEY ? 
        process.env.OPENAI_API_KEY.substring(0, 7) + '...' : 'not set',
      SCRAPEOWL_API_KEY_PREFIX: process.env.SCRAPEOWL_API_KEY ? 
        process.env.SCRAPEOWL_API_KEY.substring(0, 7) + '...' : 'not set'
    };

    return NextResponse.json({
      success: true,
      environment: envCheck,
      message: 'Environment variables check completed'
    });

  } catch (error) {
    console.error('Environment check error:', error);
    return NextResponse.json(
      { error: 'Environment check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
