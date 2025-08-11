import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[YOUTUBE TEST] API endpoint called');
  
  try {
    const body = await request.json();
    console.log('[YOUTUBE TEST] Request body:', body);
    
    const { keywords, totalLimit = 20 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      console.log('[YOUTUBE TEST] No keywords provided');
      return NextResponse.json(
        { 
          success: false, 
          error: { message: 'keywords array is required' } 
        },
        { status: 400 }
      );
    }

    // Check if YouTube API key is available
    if (!process.env.YOUTUBE_API_KEY) {
      console.log('[YOUTUBE TEST] YouTube API key not found');
      return NextResponse.json(
        { 
          success: false, 
          error: { message: 'YouTube API key not configured' } 
        },
        { status: 500 }
      );
    }

    console.log('[YOUTUBE TEST] Starting YouTube comment scraping...');
    console.log(`[YOUTUBE TEST] Keywords: ${keywords.join(', ')}`);
    console.log(`[YOUTUBE TEST] Target limit: ${totalLimit}`);

    // Import and use the Python scraper via subprocess
    // Since we can't directly import Python in TypeScript, we'll use a subprocess
    const { spawn } = require('child_process');
    const path = require('path');

    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'youtube_comment_scraper.py');
      const python = spawn('python3', ['-c', `
import sys
import os
import json
sys.path.append('${process.cwd()}')

# Set the YouTube API key from environment
os.environ['YOUTUBE_API_KEY'] = '${process.env.YOUTUBE_API_KEY}'

from youtube_comment_scraper import YouTubeCommentScraper

try:
    # Create scraper
    scraper = YouTubeCommentScraper()
    
    # Test API key validation first
    if not scraper.validate_api_key():
        result = {
            'success': False,
            'error': 'YouTube API key validation failed'
        }
    else:
        # Scrape comments for keywords
        keywords = ${JSON.stringify(keywords)}
        result_data = scraper.scrape_comments_for_keywords(keywords, total_limit=${totalLimit})
        
        # Convert to dict for JSON serialization
        result = {
            'success': True,
            'data': {
                'source': result_data.source,
                'scrape_date': result_data.scrape_date,
                'total_comments': result_data.total_comments,
                'keywords_searched': result_data.keywords_searched,
                'comments': result_data.comments[:5],  # First 5 comments for preview
                'emotional_quotes': result_data.emotional_quotes[:10],  # Top 10 quotes
                'data_quality': result_data.data_quality
            }
        }
    
    print(json.dumps(result))
    
except Exception as e:
    error_result = {
        'success': False,
        'error': str(e)
    }
    print(json.dumps(error_result))
`]);

      let output = '';
      let errorOutput = '';

      python.stdout.on('data', (data) => {
        output += data.toString();
      });

      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      python.on('close', (code) => {
        console.log('[YOUTUBE TEST] Python script finished with code:', code);
        console.log('[YOUTUBE TEST] Output:', output);
        if (errorOutput) {
          console.log('[YOUTUBE TEST] Error output:', errorOutput);
        }

        try {
          const result = JSON.parse(output.trim());
          console.log('[YOUTUBE TEST] Parsed result:', result.success ? 'SUCCESS' : 'FAILED');
          
          if (result.success) {
            console.log(`[YOUTUBE TEST] Comments collected: ${result.data?.total_comments || 0}`);
            console.log(`[YOUTUBE TEST] Emotional quotes: ${result.data?.emotional_quotes?.length || 0}`);
          }
          
          resolve(NextResponse.json(result));
        } catch (parseError) {
          console.error('[YOUTUBE TEST] Failed to parse Python output:', parseError);
          resolve(NextResponse.json({
            success: false,
            error: {
              message: 'Failed to parse scraper output',
              pythonOutput: output,
              pythonError: errorOutput
            }
          }, { status: 500 }));
        }
      });

      // Set timeout
      setTimeout(() => {
        python.kill();
        resolve(NextResponse.json({
          success: false,
          error: { message: 'YouTube scraping timeout (60s)' }
        }, { status: 408 }));
      }, 60000);
    });

  } catch (error) {
    console.error('[YOUTUBE TEST] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'YouTube test failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'YouTube Test API - POST with keywords array to test YouTube comment scraping',
    example: {
      keywords: ['customer service problems', 'frustrated with software'],
      totalLimit: 20
    }
  });
}