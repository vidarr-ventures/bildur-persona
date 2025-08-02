import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';

interface YouTubeComment {
  text: string;
  author: string;
  likeCount: number;
  publishedAt: string;
  videoTitle: string;
  videoId: string;
  source: string;
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
}

async function searchYouTubeVideos(keywords: string): Promise<any[]> {
  try {
    console.log(`Searching YouTube for videos about: ${keywords}`);
    
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('Missing YouTube API key');
    }

    const searchResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&type=video&q=${encodeURIComponent(keywords)}&` +
      `maxResults=10&order=relevance&key=${process.env.YOUTUBE_API_KEY}`
    );

    if (!searchResponse.ok) {
      throw new Error(`YouTube search failed: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    console.log(`Found ${searchData.items?.length || 0} videos`);
    
    return searchData.items || [];
    
  } catch (error) {
    console.error('YouTube search error:', error);
    throw error;
  }
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

async function extractYouTubeComments(keywords: string): Promise<{ comments: YouTubeComment[], analysis: YouTubeAnalysis }> {
  try {
    // Search for relevant videos
    const videos = await searchYouTubeVideos(keywords);
    
    if (videos.length === 0) {
      throw new Error('No YouTube videos found for keywords');
    }
    
    let allComments: YouTubeComment[] = [];
    const videoTitles: string[] = [];
    
    // Extract comments from top 5 videos
    for (const video of videos.slice(0, 5)) {
      const videoId = video.id.videoId;
      const videoTitle = video.snippet.title;
      videoTitles.push(videoTitle);
      
      const comments = await extractCommentsFromVideo(videoId, videoTitle);
      allComments = allComments.concat(comments);
      
      // Add delay to respect API rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Total comments extracted: ${allComments.length}`);
    
    // Analyze comments for insights
    const analysis = analyzeYouTubeComments(allComments, videoTitles);
    
    return {
      comments: allComments,
      analysis: analysis
    };
    
  } catch (error) {
    console.error('YouTube comments extraction error:', error);
    throw error;
  }
}

function analyzeYouTubeComments(comments: YouTubeComment[], videoTitles: string[]): YouTubeAnalysis {
  if (comments.length === 0) {
    return {
      totalComments: 0,
      extractionStatus: 'NO_COMMENTS_FOUND',
      painPoints: [],
      desires: [],
      frustrations: [],
      solutions: [],
      emotions: {},
      topVideos: videoTitles
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
  
  return {
    totalComments: comments.length,
    extractionStatus: 'SUCCESS',
    painPoints,
    desires,
    frustrations,
    solutions,
    emotions,
    topVideos: videoTitles.slice(0, 5)
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
  if (!validateInternalApiKey(request)) {
    return createAuthErrorResponse();
  }

  try {
    const { jobId, keywords } = await request.json();

    if (!jobId || !keywords) {
      return NextResponse.json({ error: 'Job ID and keywords are required' }, { status: 400 });
    }

    console.log(`Starting YouTube comments extraction for job ${jobId}, keywords: ${keywords}`);
    
    // Extract YouTube comments and analyze
    const { comments, analysis } = await extractYouTubeComments(keywords);
    
    const youtubeData = {
      comments: comments.slice(0, 20), // Store top 20 comments
      analysis: analysis,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: keywords,
        extractionMethod: 'youtube_api',
        totalCommentsFound: comments.length,
        videosAnalyzed: analysis.topVideos.length
      }
    };

    await saveJobData(jobId, 'youtube_comments', youtubeData);

    console.log(`YouTube extraction completed for job ${jobId}: ${comments.length} comments from ${analysis.topVideos.length} videos`);

    return NextResponse.json({
      success: true,
      message: 'YouTube comments extraction completed',
      data: {
        totalComments: comments.length,
        videosAnalyzed: analysis.topVideos.length,
        painPointsFound: analysis.painPoints.length,
        desiresFound: analysis.desires.length,
        frustrationssFound: analysis.frustrations.length,
        extractionStatus: analysis.extractionStatus
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