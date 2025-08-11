import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  console.log('[REDDIT PRAW] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    // Check if Reddit API credentials are configured
    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
      console.log('[REDDIT PRAW] Reddit API credentials not configured');
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            message: 'Reddit API credentials not configured. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in environment variables.',
            setup_instructions: 'Visit https://www.reddit.com/prefs/apps to create a Reddit app and get your credentials.'
          } 
        },
        { status: 500 }
      );
    }

    console.log(`[REDDIT PRAW] Searching Reddit for keywords: ${keywords.join(', ')}`);
    console.log(`[REDDIT PRAW] Total limit: ${totalLimit}`);
    
    try {
      // Prepare input for Python script
      const input = JSON.stringify({
        keywords: keywords,
        totalLimit: totalLimit
      });
      
      // Path to Python script and temporary input file
      const scriptPath = path.join(process.cwd(), 'reddit_praw_scraper.py');
      const tempInputPath = path.join(process.cwd(), `temp_input_${Date.now()}.json`);
      
      // Write input to temporary file
      writeFileSync(tempInputPath, input);
      
      try {
        // Execute Python script with environment variables
        const { stdout, stderr } = await execAsync(
          `python3 ${scriptPath} < ${tempInputPath}`,
          {
            env: {
              ...process.env,
              REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
              REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
              PYTHONIOENCODING: 'utf-8'
            },
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
          }
        );
      
      if (stderr) {
        console.log('[REDDIT PRAW] Python stderr output:', stderr);
      }
      
      // Parse Python script output
      const results = JSON.parse(stdout);
      
      if (results.error) {
        console.error('[REDDIT PRAW] Python script error:', results.error);
        return NextResponse.json(
          {
            success: false,
            error: {
              message: results.error,
              type: 'praw_error'
            }
          },
          { status: 500 }
        );
      }
      
      console.log(`[REDDIT PRAW] Successfully retrieved ${results.total_items} items`);
      console.log(`[REDDIT PRAW] Subreddits searched: ${results.data_quality?.subreddits_searched?.join(', ')}`);
      
      return NextResponse.json({
        success: true,
        data: results,
        message: "Reddit data fetched successfully using official Reddit API (PRAW)"
      });
      
      } finally {
        // Cleanup temporary file
        try {
          unlinkSync(tempInputPath);
        } catch (cleanupError) {
          console.log('[REDDIT PRAW] Failed to cleanup temp file:', cleanupError);
        }
      }
      
    } catch (pythonError) {
      console.error('[REDDIT PRAW] Error executing Python script:', pythonError);
      
      // Fallback: Try to call Python script directly with command line args
      try {
        const scriptPath = path.join(process.cwd(), 'reddit_praw_scraper.py');
        const keywordsArg = keywords.join(',');
        
        const { stdout, stderr } = await execAsync(
          `python3 ${scriptPath} "${keywordsArg}" ${totalLimit}`,
          {
            env: {
              ...process.env,
              REDDIT_CLIENT_ID: process.env.REDDIT_CLIENT_ID,
              REDDIT_CLIENT_SECRET: process.env.REDDIT_CLIENT_SECRET,
              PYTHONIOENCODING: 'utf-8'
            },
            maxBuffer: 1024 * 1024 * 10
          }
        );
        
        if (stderr) {
          console.log('[REDDIT PRAW] Python stderr output (fallback):', stderr);
        }
        
        const results = JSON.parse(stdout);
        
        return NextResponse.json({
          success: true,
          data: results,
          message: "Reddit data fetched successfully using official Reddit API (PRAW) - fallback method"
        });
        
      } catch (fallbackError) {
        console.error('[REDDIT PRAW] Fallback also failed:', fallbackError);
        
        return NextResponse.json(
          {
            success: false,
            error: {
              message: 'Failed to execute Reddit PRAW scraper',
              details: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
              help: 'Ensure Python 3 and PRAW are installed: pip3 install praw'
            }
          },
          { status: 500 }
        );
      }
    }

  } catch (error) {
    console.error('[REDDIT PRAW] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit PRAW API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Reddit Search via Official Reddit API (PRAW) - POST with keywords array',
    example: {
      keywords: ['grounding sheets', 'earthing sheets', 'grounding for health'],
      totalLimit: 25
    },
    note: 'This endpoint uses the official Reddit API through PRAW (Python Reddit API Wrapper). Requires REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET environment variables.',
    setup: {
      step1: 'Visit https://www.reddit.com/prefs/apps',
      step2: 'Click "Create App" or "Create Another App"',
      step3: 'Fill in: Name (any), Type (script), Description (any), About URL (blank), Redirect URI (http://localhost:8080)',
      step4: 'After creation, note your Client ID (under "personal use script") and Secret',
      step5: 'Add to .env.local: REDDIT_CLIENT_ID=your_id and REDDIT_CLIENT_SECRET=your_secret'
    }
  });
}