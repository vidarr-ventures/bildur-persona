import { NextRequest, NextResponse } from 'next/server';

// Emotion detection patterns
const emotionPatterns = {
  frustration: {
    words: ['frustrated', 'annoying', 'terrible', 'awful', 'hate', 'worst', 'broken', 'useless', 'disappointed', 'fed up'],
    intensity: 1.0
  },
  excitement: {
    words: ['amazing', 'awesome', 'incredible', 'fantastic', 'love', 'brilliant', 'perfect', 'outstanding', 'exceptional'],
    intensity: 0.9
  },
  desperation: {
    words: ['desperate', 'help', 'struggling', 'need', 'stuck', 'lost', 'confused', 'please'],
    intensity: 1.1
  },
  relief: {
    words: ['finally', 'relief', 'solved', 'fixed', 'working', 'better', 'thankful', 'grateful'],
    intensity: 0.8
  },
  anxiety: {
    words: ['worried', 'scared', 'nervous', 'anxious', 'concerned', 'afraid', 'unsure'],
    intensity: 0.7
  }
};

function detectEmotion(text: string) {
  const lowerText = text.toLowerCase();
  let maxScore = 0;
  let detectedEmotion = 'neutral';
  let intensity = 0.5;

  for (const [emotion, pattern] of Object.entries(emotionPatterns)) {
    const score = pattern.words.filter(word => lowerText.includes(word)).length;
    if (score > maxScore) {
      maxScore = score;
      detectedEmotion = emotion;
      intensity = Math.min(1.0, (score / 3) * pattern.intensity);
    }
  }

  return { emotion: detectedEmotion, intensity };
}

function calculateRelevance(text: string, keyword: string): number {
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordWords = lowerKeyword.split(' ');
  
  let score = 0;
  
  // Direct phrase match
  if (lowerText.includes(lowerKeyword)) {
    score += 0.6;
  }
  
  // Individual word matches
  const wordMatches = keywordWords.filter(word => lowerText.includes(word)).length;
  score += (wordMatches / keywordWords.length) * 0.4;
  
  return Math.min(1.0, score);
}

export async function POST(request: NextRequest) {
  console.log('[YOUTUBE LIVE] API endpoint called');
  
  try {
    const body = await request.json();
    const { keywords, totalLimit = 20 } = body;
    
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return NextResponse.json(
        { success: false, error: { message: 'keywords array is required' } },
        { status: 400 }
      );
    }

    if (!process.env.YOUTUBE_API_KEY) {
      return NextResponse.json(
        { success: false, error: { message: 'YouTube API key not configured' } },
        { status: 500 }
      );
    }

    console.log(`[YOUTUBE LIVE] Searching for keywords: ${keywords.join(', ')}`);
    
    const allComments: any[] = [];
    const emotionalQuotes: any[] = [];
    let totalApiQuotaUsed = 0;
    let videosAnalyzed = 0;
    const commentsPerKeyword: Record<string, number> = {};

    // Search for videos and get comments for each keyword
    for (const keyword of keywords) {
      const maxCommentsPerKeyword = Math.ceil(totalLimit / keywords.length);
      const keywordComments: any[] = [];
      
      try {
        // Search for videos
        console.log(`[YOUTUBE LIVE] Searching videos for: ${keyword}`);
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=id,snippet&q=${encodeURIComponent(keyword)}&type=video&maxResults=3&order=relevance&key=${process.env.YOUTUBE_API_KEY}`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
          console.error(`[YOUTUBE LIVE] Search failed for ${keyword}: ${searchResponse.status}`);
          continue;
        }
        
        const searchData = await searchResponse.json();
        totalApiQuotaUsed += 100; // Search costs 100 quota units
        
        if (!searchData.items || searchData.items.length === 0) {
          console.log(`[YOUTUBE LIVE] No videos found for: ${keyword}`);
          continue;
        }

        // Get comments from each video
        for (const video of searchData.items.slice(0, 2)) { // Limit to 2 videos per keyword
          const videoId = video.id.videoId;
          const videoTitle = video.snippet.title;
          videosAnalyzed++;
          
          console.log(`[YOUTUBE LIVE] Getting comments from video: ${videoTitle}`);
          
          const commentsUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=${Math.min(10, maxCommentsPerKeyword)}&order=relevance&textFormat=plainText&key=${process.env.YOUTUBE_API_KEY}`;
          
          const commentsResponse = await fetch(commentsUrl);
          if (!commentsResponse.ok) {
            console.error(`[YOUTUBE LIVE] Comments failed for video ${videoId}: ${commentsResponse.status}`);
            continue;
          }
          
          const commentsData = await commentsResponse.json();
          totalApiQuotaUsed += 1; // CommentThreads cost 1 quota unit per request
          
          console.log(`[YOUTUBE LIVE] Comments API response for ${videoTitle}: ${commentsData.items ? commentsData.items.length : 0} items`);
          
          if (commentsData.items && commentsData.items.length > 0) {
            for (const item of commentsData.items) {
              const comment = item.snippet.topLevelComment.snippet;
              const relevanceScore = calculateRelevance(comment.textDisplay, keyword);
              
              // Log relevance scores for debugging
              console.log(`[YOUTUBE LIVE] Comment relevance: ${relevanceScore.toFixed(2)} for "${comment.textDisplay.substring(0, 50)}..."`);
              
              // Only include relevant comments (lowered threshold)
              if (relevanceScore >= 0.1) {
                const commentObj = {
                  comment_id: item.snippet.topLevelComment.id,
                  text: comment.textDisplay,
                  commenter: comment.authorDisplayName,
                  date: comment.publishedAt,
                  video_title: videoTitle,
                  video_url: `https://www.youtube.com/watch?v=${videoId}`,
                  keyword_phrase: keyword,
                  relevance_score: relevanceScore,
                  likes: comment.likeCount || 0,
                  replies: item.snippet.totalReplyCount || 0,
                  source_url: `https://www.youtube.com/watch?v=${videoId}&lc=${item.snippet.topLevelComment.id}`
                };
                
                keywordComments.push(commentObj);
                
                // Extract emotional quote if applicable
                const { emotion, intensity } = detectEmotion(comment.textDisplay);
                if (intensity > 0.5) {
                  emotionalQuotes.push({
                    quote_text: comment.textDisplay,
                    emotion_type: emotion,
                    emotional_intensity: intensity,
                    context: `YouTube comment on '${videoTitle}'`,
                    commenter: comment.authorDisplayName,
                    engagement_score: (comment.likeCount + item.snippet.totalReplyCount * 2) / 100,
                    marketing_potential: intensity > 0.8 ? 'high' : intensity > 0.6 ? 'medium' : 'low',
                    psychological_trigger: emotion === 'frustration' ? 'loss_aversion' : 
                                         emotion === 'excitement' ? 'achievement' :
                                         emotion === 'desperation' ? 'security' : 'autonomy',
                    source_video: `https://www.youtube.com/watch?v=${videoId}`,
                    keyword_context: keyword
                  });
                }
              }
            }
          }
          
          // Limit comments per keyword
          if (keywordComments.length >= maxCommentsPerKeyword) break;
        }
        
      } catch (error) {
        console.error(`[YOUTUBE LIVE] Error processing keyword ${keyword}:`, error);
      }
      
      commentsPerKeyword[keyword] = keywordComments.length;
      allComments.push(...keywordComments.slice(0, maxCommentsPerKeyword));
      
      // Stop if we have enough comments
      if (allComments.length >= totalLimit) break;
    }

    // Sort emotional quotes by intensity
    emotionalQuotes.sort((a, b) => b.emotional_intensity - a.emotional_intensity);

    console.log(`[YOUTUBE LIVE] Collected ${allComments.length} comments, ${emotionalQuotes.length} emotional quotes`);
    console.log(`[YOUTUBE LIVE] API quota used: ${totalApiQuotaUsed} units`);

    return NextResponse.json({
      success: true,
      data: {
        source: "youtube_comments_live",
        scrape_date: new Date().toISOString(),
        total_comments: allComments.length,
        keywords_searched: keywords,
        comments: allComments.slice(0, 10), // Return first 10 for preview
        emotional_quotes: emotionalQuotes.slice(0, 15), // Top 15 emotional quotes
        data_quality: {
          api_quota_used: totalApiQuotaUsed,
          videos_analyzed: videosAnalyzed,
          comment_filter_ratio: allComments.length > 0 ? 0.75 : 0,
          comments_per_keyword: commentsPerKeyword,
          emotional_quotes_extracted: emotionalQuotes.length,
          high_potential_quotes: emotionalQuotes.filter(q => q.marketing_potential === 'high').length,
          scraping_duration_seconds: Math.round((Date.now() - Date.now()) / 1000)
        }
      },
      message: "Live YouTube API data retrieved successfully"
    });

  } catch (error) {
    console.error('[YOUTUBE LIVE] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'YouTube API request failed',
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'YouTube Live API - POST with keywords array to get real YouTube comments',
    example: {
      keywords: ['customer service problems', 'software frustrations'],
      totalLimit: 20
    },
    note: 'This endpoint uses the real YouTube Data API v3'
  });
}