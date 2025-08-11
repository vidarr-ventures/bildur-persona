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

    console.log('[YOUTUBE TEST] Starting YouTube API validation...');
    console.log(`[YOUTUBE TEST] Keywords: ${keywords.join(', ')}`);
    console.log(`[YOUTUBE TEST] Target limit: ${totalLimit}`);

    // For now, let's create a mock response that shows the API key is available
    // and simulates what the YouTube scraper would return
    const mockResult = {
      success: true,
      data: {
        source: "youtube_comments",
        scrape_date: new Date().toISOString(),
        total_comments: 15,
        keywords_searched: keywords,
        comments: [
          {
            comment_id: "mock_comment_1",
            text: "I've been struggling with customer service issues for my small business. This solution looks promising!",
            commenter: "SmallBizOwner2024",
            date: "2025-01-10T10:00:00Z",
            video_title: "Top Customer Service Solutions",
            video_url: "https://www.youtube.com/watch?v=mock1",
            keyword_phrase: keywords[0],
            relevance_score: 0.75,
            likes: 12,
            replies: 3,
            source_url: "https://www.youtube.com/watch?v=mock1&lc=mock_comment_1"
          },
          {
            comment_id: "mock_comment_2", 
            text: "As a frustrated software user, I desperately need something that actually works for my business needs.",
            commenter: "FrustratedUser",
            date: "2025-01-09T15:30:00Z",
            video_title: "Software Review: Tools That Work",
            video_url: "https://www.youtube.com/watch?v=mock2",
            keyword_phrase: keywords[1] || keywords[0],
            relevance_score: 0.82,
            likes: 28,
            replies: 8,
            source_url: "https://www.youtube.com/watch?v=mock2&lc=mock_comment_2"
          }
        ],
        emotional_quotes: [
          {
            quote_text: "I desperately need something that actually works for my business needs.",
            emotion_type: "desperation",
            emotional_intensity: 0.85,
            context: "YouTube comment on 'Software Review: Tools That Work'",
            commenter: "FrustratedUser",
            engagement_score: 0.36,
            marketing_potential: "high",
            psychological_trigger: "autonomy",
            source_video: "https://www.youtube.com/watch?v=mock2",
            keyword_context: keywords[1] || keywords[0]
          },
          {
            quote_text: "This solution looks promising for my small business!",
            emotion_type: "excitement", 
            emotional_intensity: 0.65,
            context: "YouTube comment on 'Top Customer Service Solutions'",
            commenter: "SmallBizOwner2024",
            engagement_score: 0.15,
            marketing_potential: "medium",
            psychological_trigger: "achievement",
            source_video: "https://www.youtube.com/watch?v=mock1",
            keyword_context: keywords[0]
          }
        ],
        data_quality: {
          api_quota_used: 315, // Realistic quota usage for 15 comments
          videos_analyzed: 6,
          comment_filter_ratio: 0.75,
          comments_per_keyword: keywords.reduce((acc, kw, i) => ({ ...acc, [kw]: i < 2 ? 7 + i : 1 }), {}),
          emotional_quotes_extracted: 2,
          high_potential_quotes: 1,
          scraping_duration_seconds: 45.2
        }
      },
      message: "Mock response - YouTube API key is configured and available",
      api_key_available: true,
      note: "This is a simulated response showing what the YouTube scraper would return. The actual Python scraper is not executed in this Vercel serverless environment, but the API key is available for use."
    };

    console.log('[YOUTUBE TEST] Returning mock result');
    console.log(`[YOUTUBE TEST] Mock comments: ${mockResult.data.total_comments}`);
    console.log(`[YOUTUBE TEST] Mock quotes: ${mockResult.data.emotional_quotes.length}`);

    return NextResponse.json(mockResult);

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