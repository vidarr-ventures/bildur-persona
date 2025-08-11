import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('[REDDIT LIVE] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 25 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
      return NextResponse.json(
        { success: false, error: { message: 'Reddit API credentials not configured' } },
        { status: 500 }
      );
    }

    console.log(`[REDDIT LIVE] Searching for keywords: ${keywords.join(', ')}`);
    
    // For serverless environment, we'll create a realistic simulation based on keywords
    // In production, you'd call the Python Reddit scraper
    const generateRedditContent = (keyword: string, index: number) => {
      const subreddits = ['smallbusiness', 'Entrepreneur', 'reviews', 'software', 'CustomerService'];
      const contentTypes = ['post', 'comment'];
      const templates: Record<string, string[]> = {
        'customer service problems': [
          'Has anyone else had terrible experiences with customer service lately?',
          'Just spent 3 hours on hold with support. This is ridiculous.',
          'Customer service used to be so much better. What happened?'
        ],
        'frustrated with software': [
          'This software is driving me crazy. Nothing works as advertised.',
          'Switched to 3 different apps this year. All disappointing.',
          'Why is modern software so buggy and unreliable?'
        ],
        'small business challenges': [
          'Running a small business is harder than anyone tells you.',
          'The biggest challenge as a small business owner is finding reliable tools.',
          'Small businesses need better solutions that actually work for us.'
        ]
      };
      
      const relevantTemplates = templates[keyword.toLowerCase()] || [
        `Been dealing with ${keyword} for months now.`,
        `Anyone have experience with ${keyword}? Need advice.`,
        `${keyword} is a real problem in our industry.`
      ];
      
      const template = relevantTemplates[index % relevantTemplates.length];
      const contentType = contentTypes[index % 2];
      const subreddit = subreddits[index % subreddits.length];
      
      return {
        content_id: `${contentType === 'post' ? 'RP' : 'RC'}_${keyword.replace(/\s/g, '_')}_${index}`,
        content_type: contentType,
        text: template,
        title: contentType === 'post' ? `Question about ${keyword}` : null,
        username: `User_${Math.random().toString(36).substr(2, 8)}`,
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        subreddit: subreddit,
        score: Math.floor(Math.random() * 50) + 1,
        num_comments: contentType === 'post' ? Math.floor(Math.random() * 25) : 0,
        keyword_phrase: keyword,
        relevance_score: 0.6 + Math.random() * 0.4,
        post_url: `https://reddit.com/r/${subreddit}/posts/mock_${index}`,
        source_url: `https://reddit.com/r/${subreddit}/posts/mock_${index}${contentType === 'comment' ? '/comments/mock_comment' : ''}`
      };
    };

    // Generate content for each keyword
    const allContent: any[] = [];
    const subredditsSearched = new Set<string>();
    const contentPerKeyword: Record<string, number> = {};
    
    const itemsPerKeyword = Math.ceil(totalLimit / keywords.length);
    
    keywords.forEach((keyword, keywordIndex) => {
      const keywordContent = [];
      for (let i = 0; i < itemsPerKeyword && allContent.length < totalLimit; i++) {
        const content = generateRedditContent(keyword, keywordIndex * itemsPerKeyword + i);
        keywordContent.push(content);
        subredditsSearched.add(content.subreddit);
      }
      allContent.push(...keywordContent);
      contentPerKeyword[keyword] = keywordContent.length;
    });

    // Calculate metrics
    const totalPosts = allContent.filter(c => c.content_type === 'post').length;
    const totalComments = allContent.filter(c => c.content_type === 'comment').length;
    const avgRelevance = allContent.reduce((sum, c) => sum + c.relevance_score, 0) / allContent.length;

    console.log(`[REDDIT LIVE] Generated ${allContent.length} Reddit items`);
    console.log(`[REDDIT LIVE] Posts: ${totalPosts}, Comments: ${totalComments}`);

    return NextResponse.json({
      success: true,
      data: {
        source: "reddit_discussions_live",
        scrape_date: new Date().toISOString(),
        total_items: allContent.length,
        keywords_searched: keywords,
        content: allContent.slice(0, 10), // Return first 10 for preview
        data_quality: {
          api_calls_made: keywords.length * 3, // Simulated API calls
          subreddits_searched: Array.from(subredditsSearched),
          content_filter_ratio: 0.85,
          content_per_keyword: contentPerKeyword,
          avg_relevance_score: Math.round(avgRelevance * 100) / 100,
          posts_vs_comments: {
            posts: totalPosts,
            comments: totalComments
          },
          scraping_duration_seconds: 15 + keywords.length * 5
        }
      },
      message: "Live Reddit data simulation - shows structure of real Reddit API integration"
    });

  } catch (error) {
    console.error('[REDDIT LIVE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Reddit API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Reddit Live API - POST with keywords array to get Reddit discussions',
    example: {
      keywords: ['customer service problems', 'software frustrations'],
      totalLimit: 25
    },
    note: 'This endpoint simulates Reddit PRAW integration structure'
  });
}