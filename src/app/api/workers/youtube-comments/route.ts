import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { storeJobResult } from '@/lib/job-cache';

interface YouTubeComment {
  text: string;
  author: string;
  likeCount: number;
  publishedAt: string;
  videoTitle: string;
  videoId: string;
  source: string;
}

interface KeywordMetrics {
  keyword: string;
  videosFound: number;
  videosProcessed: number;
  commentsExtracted: number;
  successRate: number;
  topVideo?: string;
  extractionStatus: 'success' | 'partial' | 'failed' | 'no_videos';
}

interface YouTubeAnalysis {
  totalComments: number;
  extractionStatus: string;
  painPoints: string[];
  desires: string[];
  frustrations: string[];
  solutions: string[];
  emotions: Record<string, number>;
  topVideos: string[];
  keywordMetrics: KeywordMetrics[];
  keywordSummary: {
    totalKeywords: number;
    successfulKeywords: number;
    failedKeywords: number;
    mostProductiveKeyword: string;
    leastProductiveKeyword: string;
  };
}

async function searchYouTubeVideosForKeyword(keyword: string, maxResults: number = 10): Promise<any[]> {
  try {
    console.log(`Searching YouTube for videos about: "${keyword}"`);
    
    if (!process.env.YOUTUBE_API_KEY) {
      console.warn('YouTube API key not configured - skipping YouTube extraction');
      return [];
    }

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&type=video&q=${encodeURIComponent(keyword)}&` +
      `maxResults=${maxResults}&order=relevance&key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!searchResponse.ok) {
      if (searchResponse.status === 403) {
        console.warn(`YouTube API quota exceeded or API key invalid (403) - skipping keyword "${keyword}"`);
        return [];
      }
      throw new Error(`YouTube search failed for "${keyword}": ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.items?.length || 0} videos for keyword "${keyword}"`);
    
    return searchData.items || [];
    
  } catch (error) {
    console.error(`YouTube search error for keyword "${keyword}":`, error);
    return [];
  }
}

async function searchYouTubeVideosWithTracking(keywords: string): Promise<{ videos: any[], keywordVideoMap: Map<string, any[]> }> {
  try {
    console.log(`Starting multi-keyword YouTube search with tracking for: ${keywords}`);
    
    // Parse keywords - split by comma, semicolon, or pipe and clean
    const keywordList = keywords
      .split(/[,;|]/)
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    console.log(`Parsed into ${keywordList.length} individual keywords:`, keywordList);
    
    if (keywordList.length === 0) {
      console.warn('No valid keywords provided');
      return { videos: [], keywordVideoMap: new Map() };
    }
    
    let allVideos: any[] = [];
    const keywordVideoMap = new Map<string, any[]>();
    const videosPerKeyword = Math.max(3, Math.floor(15 / keywordList.length));
    
    // Search for each keyword separately with tracking
    for (const keyword of keywordList) {
      console.log(`\n🔍 Searching for keyword: "${keyword}" (max ${videosPerKeyword} videos)`);
      
      const videos = await searchYouTubeVideosForKeyword(keyword, videosPerKeyword);
      keywordVideoMap.set(keyword, videos);
      
      if (videos.length > 0) {
        // Tag videos with the keyword they came from for debugging
        const taggedVideos = videos.map(video => ({
          ...video,
          searchKeyword: keyword,
          keywordRelevance: keyword.toLowerCase().includes('sleep') ? 'high' : 'medium'
        }));
        
        allVideos = allVideos.concat(taggedVideos);
        console.log(`✅ Added ${videos.length} videos from keyword "${keyword}"`);
      } else {
        console.log(`⚠️ No videos found for keyword "${keyword}"`);
      }
      
      // Rate limiting between keyword searches
      if (keywordList.indexOf(keyword) < keywordList.length - 1) {
        console.log('⏱️ Rate limiting: waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Remove duplicates based on video ID
    const uniqueVideos = allVideos.filter((video, index, array) => 
      array.findIndex(v => v.id.videoId === video.id.videoId) === index
    );
    
    console.log(`\n📊 Multi-keyword search complete with tracking:`)
    console.log(`   - Total videos found: ${allVideos.length}`);
    console.log(`   - Unique videos: ${uniqueVideos.length}`);
    console.log(`   - Keywords processed: ${keywordList.length}`);
    
    // Sort by relevance and return top results
    const sortedVideos = uniqueVideos
      .sort((a, b) => {
        if (a.keywordRelevance !== b.keywordRelevance) {
          return a.keywordRelevance === 'high' ? -1 : 1;
        }
        return 0;
      })
      .slice(0, 15);
    
    console.log(`🎯 Returning top ${sortedVideos.length} videos for comment extraction`);
    return { videos: sortedVideos, keywordVideoMap };
    
  } catch (error) {
    console.error('Multi-keyword YouTube search with tracking error:', error);
    console.warn('Continuing job without YouTube data due to search error');
    return { videos: [], keywordVideoMap: new Map() };
  }
}

// Legacy function for backward compatibility
async function searchYouTubeVideos(keywords: string): Promise<any[]> {
  const { videos } = await searchYouTubeVideosWithTracking(keywords);
  return videos;
}

async function extractCommentsFromVideo(videoId: string, videoTitle: string): Promise<YouTubeComment[]> {
  try {
    console.log(`Extracting comments from video: ${videoTitle}`);
    
    const commentsResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?` +
      `part=snippet&videoId=${videoId}&maxResults=50&order=relevance&` +
      `key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!commentsResponse.ok) {
      console.log(`Comments extraction failed for video ${videoId}: ${commentsResponse.status}`);
      return [];
    }

    const commentsData = await commentsResponse.json();
    const comments: YouTubeComment[] = [];
    
    if (commentsData.items) {
      for (const item of commentsData.items) {
        const comment = item.snippet.topLevelComment.snippet;
        
        // Filter for substantive comments (not just "great video!")
        if (comment.textDisplay.length > 30) {
          comments.push({
            text: comment.textDisplay,
            author: comment.authorDisplayName,
            likeCount: comment.likeCount || 0,
            publishedAt: comment.publishedAt,
            videoTitle: videoTitle,
            videoId: videoId,
            source: 'youtube_api'
          });
        }
      }
    }
    
    console.log(`Extracted ${comments.length} substantive comments from ${videoTitle}`);
    return comments;
    
  } catch (error) {
    console.error(`Error extracting comments from video ${videoId}:`, error);
    return [];
  }
}

async function extractYouTubeComments(keywords: string): Promise<{ comments: YouTubeComment[], analysis: YouTubeAnalysis, keywordMetrics: KeywordMetrics[] }> {
  try {
    // Parse keywords first to track them
    const keywordList = keywords
      .split(/[,;|]/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0);
    
    console.log(`📊 Tracking metrics for ${keywordList.length} keywords: ${keywordList.join(', ')}`);
    
    // Initialize tracking for each keyword
    const keywordMetrics: KeywordMetrics[] = keywordList.map(keyword => ({
      keyword,
      videosFound: 0,
      videosProcessed: 0,
      commentsExtracted: 0,
      successRate: 0,
      extractionStatus: 'failed' as const
    }));
    
    // Search for relevant videos with enhanced tracking
    const { videos, keywordVideoMap } = await searchYouTubeVideosWithTracking(keywords);
    
    // Update video found counts
    keywordMetrics.forEach(metric => {
      const keywordVideos = keywordVideoMap.get(metric.keyword) || [];
      metric.videosFound = keywordVideos.length;
      metric.topVideo = keywordVideos[0]?.snippet?.title;
    });
    
    if (videos.length === 0) {
      console.warn('No YouTube videos found or API unavailable - returning empty analysis');
      
      // Mark all keywords as no_videos
      keywordMetrics.forEach(metric => {
        metric.extractionStatus = 'no_videos';
      });
      
      return {
        comments: [],
        keywordMetrics,
        analysis: {
          totalComments: 0,
          extractionStatus: 'NO_VIDEOS_FOUND_OR_API_UNAVAILABLE',
          painPoints: [],
          desires: [],
          frustrations: [],
          solutions: [],
          emotions: {},
          topVideos: [],
          keywordMetrics,
          keywordSummary: {
            totalKeywords: keywordList.length,
            successfulKeywords: 0,
            failedKeywords: keywordList.length,
            mostProductiveKeyword: 'none',
            leastProductiveKeyword: 'none'
          }
        }
      };
    }
    
    let allComments: YouTubeComment[] = [];
    const videoTitles: string[] = [];
    const keywordCommentCounts = new Map<string, number>();
    
    // Initialize comment counts for each keyword
    keywordList.forEach(keyword => {
      keywordCommentCounts.set(keyword, 0);
    });
    
    // Extract comments from top videos with per-keyword tracking
    const videosToProcess = videos.slice(0, 8);
    
    console.log(`\n📺 Processing ${videosToProcess.length} videos for comment extraction:`);
    
    for (const video of videosToProcess) {
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      const searchKeyword = video.searchKeyword || 'unknown';
      
      videoTitles.push(`${videoTitle} (found via: "${searchKeyword}")`);
      
      console.log(`📺 Processing: "${videoTitle.substring(0, 50)}..." (keyword: "${searchKeyword}")`);
      const comments = await extractCommentsFromVideo(videoId, videoTitle);
      
      // Update per-keyword metrics
      const keywordMetric = keywordMetrics.find(m => m.keyword === searchKeyword);
      if (keywordMetric) {
        keywordMetric.videosProcessed++;
        keywordMetric.commentsExtracted += comments.length;
      }
      
      // Update comment count for this keyword
      const currentCount = keywordCommentCounts.get(searchKeyword) || 0;
      keywordCommentCounts.set(searchKeyword, currentCount + comments.length);
      
      console.log(`   ✅ Extracted ${comments.length} comments (Total for "${searchKeyword}": ${currentCount + comments.length})`);
      
      // Tag comments with the search keyword for analysis
      const taggedComments = comments.map(comment => ({
        ...comment,
        searchKeyword: searchKeyword
      }));
      
      allComments = allComments.concat(taggedComments);
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Calculate final metrics and success rates
    keywordMetrics.forEach(metric => {
      if (metric.videosFound > 0) {
        metric.successRate = Math.round((metric.commentsExtracted / Math.max(metric.videosProcessed, 1)) * 100) / 100;
        
        if (metric.commentsExtracted > 0) {
          metric.extractionStatus = metric.commentsExtracted >= 5 ? 'success' : 'partial';
        } else {
          metric.extractionStatus = 'failed';
        }
      } else {
        metric.extractionStatus = 'no_videos';
      }
    });
    
    // Display detailed per-keyword summary
    console.log(`\n📊 PER-KEYWORD EXTRACTION SUMMARY:`);
    console.log(`   Total Comments Extracted: ${allComments.length}`);
    console.log(`   Keywords Processed: ${keywordList.length}`);
    
    keywordMetrics.forEach(metric => {
      const status = metric.extractionStatus === 'success' ? '✅' : 
                    metric.extractionStatus === 'partial' ? '⚠️' : 
                    metric.extractionStatus === 'no_videos' ? '🚫' : '❌';
      
      console.log(`   ${status} "${metric.keyword}": ${metric.commentsExtracted} comments (${metric.videosProcessed}/${metric.videosFound} videos processed)`);
    });
    
    // Analyze comments for insights with keyword metrics
    const analysis = analyzeYouTubeComments(allComments, videoTitles, keywordMetrics);
    
    return {
      comments: allComments,
      keywordMetrics,
      analysis: analysis
    };
    
  } catch (error) {
    console.error('YouTube comments extraction error:', error);
    throw error;
  }
}

function analyzeYouTubeComments(comments: YouTubeComment[], videoTitles: string[], keywordMetrics: KeywordMetrics[]): YouTubeAnalysis {
  if (comments.length === 0) {
    return {
      totalComments: 0,
      extractionStatus: 'NO_COMMENTS_FOUND',
      painPoints: [],
      desires: [],
      frustrations: [],
      solutions: [],
      emotions: {},
      topVideos: videoTitles,
      keywordMetrics,
      keywordSummary: {
        totalKeywords: keywordMetrics.length,
        successfulKeywords: 0,
        failedKeywords: keywordMetrics.length,
        mostProductiveKeyword: 'none',
        leastProductiveKeyword: 'none'
      }
    };
  }
  
  // Combine all comment text
  const allText = comments.map(c => c.text).join(' ').toLowerCase();
  
  // Extract different types of insights
  const painPoints = extractPainPoints(allText);
  const desires = extractDesires(allText);
  const frustrations = extractFrustrations(allText);
  const solutions = extractSolutions(allText);
  const emotions = analyzeEmotions(allText);
  
  // Calculate keyword summary
  const successfulKeywords = keywordMetrics.filter(k => k.extractionStatus === 'success').length;
  const failedKeywords = keywordMetrics.filter(k => k.extractionStatus === 'failed' || k.extractionStatus === 'no_videos').length;
  
  const mostProductiveKeyword = keywordMetrics.reduce((prev, current) => 
    current.commentsExtracted > prev.commentsExtracted ? current : prev,
    keywordMetrics[0] || { keyword: 'none', commentsExtracted: 0 }
  ).keyword;
  
  const leastProductiveKeyword = keywordMetrics.reduce((prev, current) => 
    current.commentsExtracted < prev.commentsExtracted && current.commentsExtracted > 0 ? current : prev,
    keywordMetrics.filter(k => k.commentsExtracted > 0)[0] || { keyword: 'none', commentsExtracted: 0 }
  ).keyword;
  
  return {
    totalComments: comments.length,
    extractionStatus: 'SUCCESS',
    painPoints,
    desires,
    frustrations,
    solutions,
    emotions,
    topVideos: videoTitles.slice(0, 5),
    keywordMetrics,
    keywordSummary: {
      totalKeywords: keywordMetrics.length,
      successfulKeywords,
      failedKeywords,
      mostProductiveKeyword,
      leastProductiveKeyword
    }
  };
}

function extractPainPoints(text: string): string[] {
  const patterns = [
    /(?:i have|suffering from|struggle with|problem with|can't sleep|insomnia|pain|inflammation|stress|anxiety)[\s\w]{20,100}/gi,
    /(?:chronic|constant|every night|always|never|can't seem to)[\s\w]{20,100}/gi
  ];
  
  const pains: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    pains.push(...matches.slice(0, 10));
  });
  
  return [...new Set(pains)].slice(0, 15);
}

function extractDesires(text: string): string[] {
  const patterns = [
    /(?:i want|i need|i wish|hoping for|looking for|trying to find|want to)[\s\w]{20,100}/gi,
    /(?:if only|i dream of|would love to|desperately need)[\s\w]{15,80}/gi
  ];
  
  const desires: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    desires.push(...matches.slice(0, 10));
  });
  
  return [...new Set(desires)].slice(0, 15);
}

function extractFrustrations(text: string): string[] {
  const patterns = [
    /(?:frustrated|annoying|hate|tired of|sick of|fed up|nothing works)[\s\w]{20,100}/gi,
    /(?:tried everything|doesn't work|waste of money|scam|disappointed)[\s\w]{15,80}/gi
  ];
  
  const frustrations: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    frustrations.push(...matches.slice(0, 10));
  });
  
  return [...new Set(frustrations)].slice(0, 15);
}

function extractSolutions(text: string): string[] {
  const patterns = [
    /(?:this helped|this worked|finally found|game changer|life saver|breakthrough)[\s\w]{20,100}/gi,
    /(?:solution|fix|cure|remedy|treatment|method that works)[\s\w]{15,80}/gi
  ];
  
  const solutions: string[] = [];
  patterns.forEach(pattern => {
    const matches = text.match(pattern) || [];
    solutions.push(...matches.slice(0, 10));
  });
  
  return [...new Set(solutions)].slice(0, 15);
}

function analyzeEmotions(text: string): Record<string, number> {
  return {
    desperation: (text.match(/desperate|hopeless|lost|don't know what to do|at my wit's end/g) || []).length,
    hope: (text.match(/hope|hopeful|optimistic|excited|looking forward/g) || []).length,
    frustration: (text.match(/frustrated|annoying|hate|angry|mad|irritated/g) || []).length,
    relief: (text.match(/relief|finally|thank god|breakthrough|life changing/g) || []).length,
    skepticism: (text.match(/skeptical|doubt|suspicious|not sure|sounds too good/g) || []).length,
    gratitude: (text.match(/thank|grateful|blessed|appreciate|godsend/g) || []).length
  };
}

export async function POST(request: NextRequest) {
  // Validate internal API key
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const { jobId, keywords } = await request.json();

    if (!jobId || !keywords) {
      return NextResponse.json({ error: 'Job ID and keywords are required' }, { status: 400 });
    }

    console.log(`Starting YouTube comments extraction for job ${jobId}, keywords: ${keywords}`);
    
    // Extract YouTube comments and analyze with per-keyword metrics
    const { comments, analysis, keywordMetrics } = await extractYouTubeComments(keywords);
    
    const youtubeData = {
      comments: comments.slice(0, 25),
      analysis: analysis,
      keywordMetrics: keywordMetrics,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: keywords,
        keywordProcessingMethod: 'multi_keyword_search_with_tracking',
        extractionMethod: 'youtube_api_v3',
        totalCommentsFound: comments.length,
        videosAnalyzed: analysis.topVideos.length,
        searchStrategy: 'separate_search_per_keyword_with_deduplication_and_metrics',
        keywordsProcessed: keywords.split(/[,;|]/).map((k: string) => k.trim()).filter((k: string) => k.length > 0),
        keywordBreakdown: keywordMetrics.map(m => ({
          keyword: m.keyword,
          comments: m.commentsExtracted,
          videos: m.videosProcessed,
          status: m.extractionStatus
        }))
      }
    };

    // Store result in cache for debug dashboard
    storeJobResult(jobId, 'youtube', {
      success: true,
      comments: comments,
      analysis: analysis,
      keywordMetrics: keywordMetrics,
      metadata: youtubeData.metadata,
      processingTime: Date.now(),
      statusCode: 200,
      timestamp: new Date().toISOString()
    });

    await saveJobData(jobId, 'youtube_comments', youtubeData);

    if (comments.length === 0) {
      console.log(`YouTube extraction completed for job ${jobId}: No comments extracted (API unavailable or no videos found)`);
    } else {
      console.log(`\n🎯 YOUTUBE EXTRACTION COMPLETE FOR JOB ${jobId}:`);
      console.log(`   📊 Total Comments: ${comments.length} from ${analysis.topVideos.length} videos`);
      console.log(`   🔍 Keyword Breakdown:`);
      keywordMetrics.forEach(metric => {
        const status = metric.extractionStatus === 'success' ? '✅' : 
                      metric.extractionStatus === 'partial' ? '⚠️' : 
                      metric.extractionStatus === 'no_videos' ? '🚫' : '❌';
        console.log(`      ${status} "${metric.keyword}": ${metric.commentsExtracted} comments (${metric.videosProcessed}/${metric.videosFound} videos)`);
      });
      console.log(`   🏆 Most Productive: "${analysis.keywordSummary.mostProductiveKeyword}"`);
      console.log(`   📈 Success Rate: ${analysis.keywordSummary.successfulKeywords}/${analysis.keywordSummary.totalKeywords} keywords`);
    }

    return NextResponse.json({
      success: true,
      message: comments.length === 0 ? 'YouTube comments extraction completed (no data available)' : 'YouTube comments extraction completed',
      data: {
        totalComments: comments.length,
        videosAnalyzed: analysis.topVideos.length,
        painPointsFound: analysis.painPoints.length,
        desiresFound: analysis.desires.length,
        frustrationssFound: analysis.frustrations.length,
        extractionStatus: analysis.extractionStatus,
        keywordMetrics: keywordMetrics.map(m => ({
          keyword: m.keyword,
          comments: m.commentsExtracted,
          videos: `${m.videosProcessed}/${m.videosFound}`,
          status: m.extractionStatus
        })),
        keywordSummary: analysis.keywordSummary,
        warning: comments.length === 0 ? 'YouTube API unavailable or no videos found' : undefined
      }
    });

  } catch (error) {
    console.error('YouTube comments extraction error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'YouTube comments extraction failed', details: errorMessage },
      { status: 500 }
    );
  }
}