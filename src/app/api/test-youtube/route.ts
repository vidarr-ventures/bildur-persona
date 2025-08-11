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

    // Generate dynamic mock responses based on actual keywords
    const generateMockComments = (keyword: string, index: number) => {
      const templates = [
        {
          template: `I've been struggling with ${keyword}. This solution really helped my business!`,
          emotion: "relief",
          intensity: 0.75,
          trigger: "achievement"
        },
        {
          template: `As someone dealing with ${keyword}, I desperately need something that actually works.`,
          emotion: "desperation",
          intensity: 0.85,
          trigger: "autonomy"
        },
        {
          template: `Finally found an answer to my ${keyword}! This is absolutely amazing.`,
          emotion: "excitement",
          intensity: 0.90,
          trigger: "success"
        },
        {
          template: `Still frustrated with ${keyword}, but this gives me hope.`,
          emotion: "frustration",
          intensity: 0.65,
          trigger: "security"
        },
        {
          template: `My team has been battling ${keyword} for months. This could be the solution.`,
          emotion: "anxiety",
          intensity: 0.70,
          trigger: "belonging"
        }
      ];
      
      const template = templates[index % templates.length];
      const commentId = `mock_${keyword.replace(/\s+/g, '_')}_${index}`;
      
      return {
        comment: {
          comment_id: commentId,
          text: template.template,
          commenter: `User${Math.floor(Math.random() * 9000) + 1000}`,
          date: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          video_title: `Solutions for ${keyword}`,
          video_url: `https://www.youtube.com/watch?v=${commentId}`,
          keyword_phrase: keyword,
          relevance_score: 0.65 + Math.random() * 0.35,
          likes: Math.floor(Math.random() * 50) + 5,
          replies: Math.floor(Math.random() * 15),
          source_url: `https://www.youtube.com/watch?v=${commentId}&lc=${commentId}`
        },
        quote: {
          quote_text: template.template,
          emotion_type: template.emotion,
          emotional_intensity: template.intensity,
          context: `YouTube comment on 'Solutions for ${keyword}'`,
          commenter: `User${Math.floor(Math.random() * 9000) + 1000}`,
          engagement_score: Math.random() * 0.5,
          marketing_potential: template.intensity > 0.8 ? "high" : template.intensity > 0.6 ? "medium" : "low",
          psychological_trigger: template.trigger,
          source_video: `https://www.youtube.com/watch?v=${commentId}`,
          keyword_context: keyword
        }
      };
    };

    // Generate comments and quotes for each keyword
    const allMockData = keywords.flatMap((keyword, keywordIndex) => 
      Array.from({ length: Math.min(5, Math.ceil(totalLimit / keywords.length)) }, (_, i) => 
        generateMockComments(keyword, keywordIndex * 5 + i)
      )
    );

    const mockComments = allMockData.map(d => d.comment).slice(0, totalLimit);
    const mockQuotes = allMockData
      .map(d => d.quote)
      .sort((a, b) => b.emotional_intensity - a.emotional_intensity)
      .slice(0, Math.min(10, Math.ceil(totalLimit / 2)));

    // For now, let's create a mock response that shows the API key is available
    // and simulates what the YouTube scraper would return
    const mockResult = {
      success: true,
      data: {
        source: "youtube_comments",
        scrape_date: new Date().toISOString(),
        total_comments: mockComments.length,
        keywords_searched: keywords,
        comments: mockComments.slice(0, 5), // Show first 5 for preview
        emotional_quotes: mockQuotes,
        data_quality: {
          api_quota_used: keywords.length * 100 + mockComments.length, // Dynamic based on actual search
          videos_analyzed: keywords.length * 3,
          comment_filter_ratio: 0.75,
          comments_per_keyword: keywords.reduce((acc, kw) => ({ 
            ...acc, 
            [kw]: mockComments.filter(c => c.keyword_phrase === kw).length 
          }), {}),
          emotional_quotes_extracted: mockQuotes.length,
          high_potential_quotes: mockQuotes.filter(q => q.marketing_potential === 'high').length,
          scraping_duration_seconds: 15 + keywords.length * 10
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