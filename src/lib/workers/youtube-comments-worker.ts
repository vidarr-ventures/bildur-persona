/**
 * YouTube comments worker - direct function call version
 * Simplified for now to avoid YouTube API complexity
 */
export async function youtubeCommentsWorker({
  jobId,
  keywords
}: {
  jobId: string;
  keywords: string;
}) {
  console.log(`📺 Starting YouTube comments worker for job ${jobId}`);
  console.log(`🔍 Keywords: ${keywords}`);

  try {
    // For now, return mock data to allow the pipeline to continue
    // In a full implementation, this would:
    // 1. Search YouTube for videos related to keywords
    // 2. Extract comments from those videos
    // 3. Analyze sentiment and extract insights
    
    const mockAnalysis = {
      totalComments: 0,
      videosAnalyzed: 0,
      keywordMatches: 0,
      sentiment: {
        positive: 0,
        negative: 0,
        neutral: 0
      },
      topComments: [],
      insights: []
    };

    // Determine if we have actual data (comments/videos)
    const hasActualData = (
      mockAnalysis.totalComments > 0 ||
      mockAnalysis.videosAnalyzed > 0
    );

    const result = {
      success: true, // Process completed successfully
      hasActualData: hasActualData, // Whether meaningful data was extracted
      dataCollected: hasActualData, // Legacy compatibility
      comments: [],
      analysis: {
        ...mockAnalysis,
        hasActualData: hasActualData,
        dataQuality: hasActualData ? 'good' : 'mock_empty'
      },
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: keywords,
        extractionMethod: 'youtube_api_v3_mock',
        status: 'mock_data',
        hasActualData: hasActualData
      }
    };

    if (hasActualData) {
      console.log(`✅ YouTube comments completed with data for job ${jobId}`);
      console.log(`📊 Results: ${mockAnalysis.totalComments} comments from ${mockAnalysis.videosAnalyzed} videos`);
    } else {
      console.log(`⚠️ YouTube comments completed but found no data for job ${jobId} (mock)`);
      console.log(`📊 Mock results: ${mockAnalysis.totalComments} comments, ${mockAnalysis.videosAnalyzed} videos`);
    }
    
    return result;

  } catch (error) {
    console.error(`❌ YouTube comments failed for job ${jobId}:`, error);
    throw error;
  }
}