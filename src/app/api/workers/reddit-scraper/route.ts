import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus } from '@/lib/db';
import { saveJobData } from '@/lib/db';
import { validateInternalApiKey, createAuthErrorResponse } from '@/lib/auth';
import { storeJobResult } from '@/lib/job-cache';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface RedditPost {
  title: string;
  content: string;
  score: number;
  comments: number;
  subreddit: string;
  url: string;
  timestamp: string;
  keyword: string;
  topComments?: RedditComment[];
}

interface RedditComment {
  text: string;
  score: number;
  author: string;
  timestamp: string;
}

interface KeywordMetrics {
  keyword: string;
  postsFound: number;
  commentsCollected: number;
  subredditsSearched: string[];
  topPost?: string;
  extractionStatus: 'success' | 'partial' | 'failed' | 'no_data';
}

interface RedditAnalysis {
  totalPosts: number;
  totalComments: number;
  extractionStatus: string;
  painPoints: string[];
  emotionalLanguage: string[];
  productMentions: string[];
  commonThemes: string[];
  solutionPatterns: string[];
  keywordMetrics: KeywordMetrics[];
  keywordSummary: {
    totalKeywords: number;
    successfulKeywords: number;
    failedKeywords: number;
    mostProductiveKeyword: string;
    leastProductiveKeyword: string;
  };
}

async function discoverRelevantSubreddits(keywords: string): Promise<string[]> {
  const baseSubreddits = [
    'reviews', 'BuyItForLife', 'ProductPorn', 'shutupandtakemymoney',
    'findareddit', 'tipofmytongue', 'HelpMeFind', 'whatisthisthing'
  ];
  
  // Extract subreddit names from phrases (first word of each phrase)
  const keywordSubreddits = keywords.toLowerCase()
    .split(/[,;|]/)  // Split by commas to get phrases
    .map(phrase => phrase.trim().split(' ')[0])  // Take first word of each phrase
    .filter(word => word.length > 3)
    .slice(0, 3);
  
  return [...baseSubreddits, ...keywordSubreddits];
}

async function scrapeRedditDataWithTracking(keywords: string): Promise<{ posts: RedditPost[], keywordMetrics: KeywordMetrics[] }> {
  console.log(`Starting multi-keyword Reddit search for: ${keywords}`);
  
  // Parse keywords
  const keywordList = keywords
    .split(/[,;|]/)
    .map(k => k.trim())
    .filter(k => k.length > 0);
  
  console.log(`Parsed into ${keywordList.length} individual keywords:`, keywordList);
  
  if (keywordList.length === 0) {
    return { posts: [], keywordMetrics: [] };
  }
  
  const allPosts: RedditPost[] = [];
  const keywordMetrics: KeywordMetrics[] = [];
  
  // Discover relevant subreddits
  const subreddits = await discoverRelevantSubreddits(keywords);
  console.log(`Searching across ${subreddits.length} subreddits:`, subreddits.slice(0, 8));
  
  // Search each keyword separately
  for (const keyword of keywordList) {
    console.log(`\n🔍 Searching Reddit for keyword: "${keyword}"`);
    
    const keywordPosts: RedditPost[] = [];
    const subredditsSearched: string[] = [];
    
    for (const subreddit of subreddits.slice(0, 8)) {
      try {
        const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(keyword)}&restrict_sr=1&sort=relevance&limit=20`;
        
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'PersonaBot/1.0 (Research)'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Reddit API error for r/${subreddit}:`, {
            status: response.status,
            error: errorText,
            searchUrl
          });
          
          if (response.status === 429) {
            console.error('Reddit rate limit hit - waiting 5 seconds...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          }
          continue;
        }
        
        const data = await response.json();
        subredditsSearched.push(subreddit);
        
        if (data.data?.children) {
          for (const child of data.data.children) {
            const post = child.data;
            
            // Get top comments for this post
            const topComments = await fetchTopComments(post.permalink, 3);
            
            keywordPosts.push({
              title: post.title || '',
              content: post.selftext || '',
              score: post.score || 0,
              comments: post.num_comments || 0,
              subreddit: post.subreddit || subreddit,
              url: `https://reddit.com${post.permalink}`,
              timestamp: new Date(post.created_utc * 1000).toISOString(),
              keyword: keyword,
              topComments: topComments
            });
          }
        }
        
        // Rate limiting between subreddit searches
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Error scraping r/${subreddit}:`, error);
      }
    }
    
    // Sort and take top posts for this keyword
    const topKeywordPosts = keywordPosts
      .sort((a, b) => b.score - a.score)
      .slice(0, 15);
    
    allPosts.push(...topKeywordPosts);
    
    // Calculate metrics for this keyword
    const totalComments = topKeywordPosts.reduce((sum, post) => 
      sum + (post.topComments?.length || 0), 0
    );
    
    keywordMetrics.push({
      keyword,
      postsFound: topKeywordPosts.length,
      commentsCollected: totalComments,
      subredditsSearched,
      topPost: topKeywordPosts[0]?.title,
      extractionStatus: topKeywordPosts.length > 0 ? 'success' : 'no_data'
    });
    
    console.log(`✅ "${keyword}": ${topKeywordPosts.length} posts, ${totalComments} comments from ${subredditsSearched.length} subreddits`);
  }
  
  console.log(`\n📊 Reddit search complete: ${allPosts.length} total posts from ${keywordList.length} keywords`);
  
  return { posts: allPosts, keywordMetrics };
}

async function fetchTopComments(permalink: string, limit: number = 3): Promise<RedditComment[]> {
  try {
    const commentsUrl = `https://www.reddit.com${permalink}.json?limit=${limit}&sort=top`;
    
    const response = await fetch(commentsUrl, {
      headers: {
        'User-Agent': 'PersonaBot/1.0 (Research)'
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    const comments: RedditComment[] = [];
    
    if (data[1]?.data?.children) {
      for (const child of data[1].data.children.slice(0, limit)) {
        const comment = child.data;
        if (comment.body && comment.body !== '[deleted]' && comment.body.length > 20) {
          comments.push({
            text: comment.body,
            score: comment.score || 0,
            author: comment.author || 'unknown',
            timestamp: new Date(comment.created_utc * 1000).toISOString()
          });
        }
      }
    }
    
    return comments;
  } catch (error) {
    console.error('Error fetching comments:', error);
    return [];
  }
}

async function analyzeRedditWithOpenAI(posts: RedditPost[], keywords: string, keywordMetrics: KeywordMetrics[]): Promise<RedditAnalysis> {
  if (posts.length === 0) {
    return {
      totalPosts: 0,
      totalComments: 0,
      extractionStatus: 'NO_DATA_FOUND',
      painPoints: [],
      emotionalLanguage: [],
      productMentions: [],
      commonThemes: [],
      solutionPatterns: [],
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
  
  console.log(`🤖 Analyzing ${posts.length} Reddit posts with OpenAI...`);
  
  // Prepare data for OpenAI analysis
  const redditContent = posts.map(post => {
    const commentsText = post.topComments?.map(c => `Comment: ${c.text}`).join('\n') || '';
    return `POST: ${post.title}\nCONTENT: ${post.content}\nSUBREDDIT: r/${post.subreddit}\nSCORE: ${post.score}\nKEYWORD: ${post.keyword}\n${commentsText}\n---`;
  }).join('\n\n');
  
  const analysisPrompt = `Analyze these Reddit posts and comments about "${keywords}". Extract insights for customer persona research:

${redditContent.substring(0, 12000)}

Please analyze and return JSON with:
1. **painPoints** - Array of exact quotes showing problems people discuss
2. **emotionalLanguage** - Array of frustrated, desperate, excited comments with emotional intensity
3. **productMentions** - Array of specific brands/solutions mentioned
4. **commonThemes** - Array of recurring topics/concerns
5. **solutionPatterns** - Array of what actually worked for people (with quotes)

Focus on extracting exact quotes that reveal customer pain points and emotions. Return only valid JSON.`;
  
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert at analyzing Reddit discussions for customer research. Extract exact quotes and emotional language that reveal customer pain points, desires, and solutions. Always return valid JSON."
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });
    
    const analysisText = completion.choices[0]?.message?.content || '{}';
    const aiAnalysis = JSON.parse(analysisText);
    
    console.log(`✅ OpenAI analysis complete - found ${aiAnalysis.painPoints?.length || 0} pain points`);
    
    // Calculate keyword summary
    const successfulKeywords = keywordMetrics.filter(k => k.extractionStatus === 'success').length;
    const failedKeywords = keywordMetrics.filter(k => k.extractionStatus === 'no_data').length;
    
    const mostProductiveKeyword = keywordMetrics.reduce((prev, current) => 
      current.postsFound > prev.postsFound ? current : prev,
      keywordMetrics[0] || { keyword: 'none', postsFound: 0 }
    ).keyword;
    
    const leastProductiveKeyword = keywordMetrics.reduce((prev, current) => 
      current.postsFound < prev.postsFound && current.postsFound > 0 ? current : prev,
      keywordMetrics.filter(k => k.postsFound > 0)[0] || { keyword: 'none', postsFound: 0 }
    ).keyword;
    
    const totalComments = posts.reduce((sum, post) => sum + (post.topComments?.length || 0), 0);
    
    return {
      totalPosts: posts.length,
      totalComments,
      extractionStatus: 'SUCCESS',
      painPoints: aiAnalysis.painPoints || [],
      emotionalLanguage: aiAnalysis.emotionalLanguage || [],
      productMentions: aiAnalysis.productMentions || [],
      commonThemes: aiAnalysis.commonThemes || [],
      solutionPatterns: aiAnalysis.solutionPatterns || [],
      keywordMetrics,
      keywordSummary: {
        totalKeywords: keywordMetrics.length,
        successfulKeywords,
        failedKeywords,
        mostProductiveKeyword,
        leastProductiveKeyword
      }
    };
    
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    
    // Fallback analysis if OpenAI fails
    return {
      totalPosts: posts.length,
      totalComments: posts.reduce((sum, post) => sum + (post.topComments?.length || 0), 0),
      extractionStatus: 'OPENAI_FAILED_FALLBACK_USED',
      painPoints: [],
      emotionalLanguage: [],
      productMentions: [],
      commonThemes: [],
      solutionPatterns: [],
      keywordMetrics,
      keywordSummary: {
        totalKeywords: keywordMetrics.length,
        successfulKeywords: keywordMetrics.filter(k => k.extractionStatus === 'success').length,
        failedKeywords: keywordMetrics.filter(k => k.extractionStatus === 'no_data').length,
        mostProductiveKeyword: 'analysis_failed',
        leastProductiveKeyword: 'analysis_failed'
      }
    };
  }
}

export async function POST(request: NextRequest) {
  // TEMPORARILY DISABLED: Validate internal API key for testing
  // if (!validateInternalApiKey(request)) {
  //   return createAuthErrorResponse();
  // }

  try {
    const { jobId, targetKeywords } = await request.json();

    if (!jobId || !targetKeywords) {
      return NextResponse.json({ error: 'Job ID and target keywords are required' }, { status: 400 });
    }

    console.log(`Starting Reddit data collection for job ${jobId} with keywords: ${targetKeywords}`);
    
    if (!process.env.OPENAI_API_KEY) {
      console.warn('OpenAI API key not configured - Reddit analysis will be limited');
    }
    
    // Update job status
    await updateJobStatus(jobId, 'processing');
    
    // Scrape Reddit data with per-keyword tracking
    const { posts, keywordMetrics } = await scrapeRedditDataWithTracking(targetKeywords);
    
    // Store intermediate result in cache for debug dashboard
    storeJobResult(jobId, 'reddit', {
      success: posts.length > 0,
      posts: posts,
      keywordMetrics: keywordMetrics,
      metadata: {
        extraction_method: 'reddit_api_v1_with_openai',
        processing_time: Date.now(),
        cost_savings: 'No Firecrawl costs - using direct Reddit API'
      },
      processingTime: Date.now(),
      statusCode: posts.length > 0 ? 200 : 404,
      error: posts.length === 0 ? 'No Reddit posts found for the given keywords' : null,
      hasActualData: posts.length > 0,
      dataCollected: posts.length > 0
    });

    await updateJobStatus(jobId, 'processing');
    
    if (posts.length === 0) {
      console.log('\n⚠️ No Reddit posts found, saving empty results');
      
      const emptyAnalysis: RedditAnalysis = {
        totalPosts: 0,
        totalComments: 0,
        extractionStatus: 'NO_DATA_FOUND',
        painPoints: [],
        emotionalLanguage: [],
        productMentions: [],
        commonThemes: [],
        solutionPatterns: [],
        keywordMetrics,
        keywordSummary: {
          totalKeywords: keywordMetrics.length,
          successfulKeywords: 0,
          failedKeywords: keywordMetrics.length,
          mostProductiveKeyword: 'none',
          leastProductiveKeyword: 'none'
        }
      };
      
      await saveJobData(jobId, 'reddit', {
        posts: [],
        analysis: emptyAnalysis,
        keywordMetrics: keywordMetrics,
        metadata: {
          timestamp: new Date().toISOString(),
          keywords: targetKeywords,
          keywordProcessingMethod: 'multi_keyword_search_with_tracking',
          extractionMethod: 'reddit_api_v1',
          totalPostsFound: 0,
          subredditsSearched: 0,
          keywordsProcessed: targetKeywords.split(/[,;|]/).map((k: string) => k.trim()).filter((k: string) => k.length > 0)
        }
      });
      
      return NextResponse.json({
        success: false, // Changed: success should be false when no data found
        message: 'Reddit scraping completed (no posts found)',
        data: {
          postCount: 0,
          keywordMetrics: keywordMetrics.map(m => ({
            keyword: m.keyword,
            posts: m.postsFound,
            status: m.extractionStatus
          })),
          keywordSummary: emptyAnalysis.keywordSummary
        },
        hasActualData: false,
        dataCollected: false
      });
    }

    console.log(`\n🤖 Analyzing ${posts.length} Reddit posts with OpenAI...`);
    await updateJobStatus(jobId, 'processing');
    
    // Analyze with OpenAI
    const analysis = await analyzeRedditWithOpenAI(posts, targetKeywords, keywordMetrics);
    
    const redditData = {
      posts: posts,
      analysis: analysis,
      keywordMetrics: keywordMetrics,
      metadata: {
        timestamp: new Date().toISOString(),
        keywords: targetKeywords,
        keywordProcessingMethod: 'multi_keyword_search_with_openai_analysis',
        extractionMethod: 'reddit_api_v1_plus_openai',
        totalPostsFound: posts.length,
        totalCommentsCollected: analysis.totalComments,
        subredditsSearched: [...new Set(posts.map(p => p.subreddit))].length,
        searchStrategy: 'separate_search_per_keyword_with_comments',
        keywordsProcessed: targetKeywords.split(/[,;|]/).map((k: string) => k.trim()).filter((k: string) => k.length > 0),
        keywordBreakdown: keywordMetrics.map(m => ({
          keyword: m.keyword,
          posts: m.postsFound,
          comments: m.commentsCollected,
          status: m.extractionStatus
        }))
      }
    };

    await updateJobStatus(jobId, 'processing');

    // Save the Reddit analysis data
    await saveJobData(jobId, 'reddit', redditData);

    // Enhanced logging matching YouTube worker quality
    console.log(`\n🎯 REDDIT EXTRACTION COMPLETE FOR JOB ${jobId}:`);
    console.log(`   📊 Total Posts: ${posts.length} with ${analysis.totalComments} comments`);
    console.log(`   🔍 Keyword Breakdown:`);
    keywordMetrics.forEach(metric => {
      const status = metric.extractionStatus === 'success' ? '✅' : 
                    metric.extractionStatus === 'partial' ? '⚠️' : 
                    metric.extractionStatus === 'no_data' ? '🚫' : '❌';
      console.log(`      ${status} "${metric.keyword}": ${metric.postsFound} posts, ${metric.commentsCollected} comments from ${metric.subredditsSearched.length} subreddits`);
    });
    console.log(`   🏆 Most Productive: "${analysis.keywordSummary.mostProductiveKeyword}"`);
    console.log(`   📈 Success Rate: ${analysis.keywordSummary.successfulKeywords}/${analysis.keywordSummary.totalKeywords} keywords`);
    console.log(`   🤖 OpenAI Analysis: ${analysis.painPoints.length} pain points, ${analysis.solutionPatterns.length} solutions found`);

    return NextResponse.json({
      success: posts.length > 0, // Changed: success based on actual data found
      message: 'Reddit data collection and analysis completed',
      data: {
        postCount: posts.length,
        commentsCollected: analysis.totalComments,
        subredditsSearched: [...new Set(posts.map(p => p.subreddit))].length,
        painPointsFound: analysis.painPoints.length,
        solutionPatternsFound: analysis.solutionPatterns.length,
        productMentionsFound: analysis.productMentions.length,
        extractionStatus: analysis.extractionStatus,
        keywordMetrics: keywordMetrics.map(m => ({
          keyword: m.keyword,
          posts: m.postsFound,
          comments: m.commentsCollected,
          subreddits: m.subredditsSearched.length,
          status: m.extractionStatus
        })),
        keywordSummary: analysis.keywordSummary
      },
      hasActualData: posts.length > 0,
      dataCollected: posts.length > 0
    });

  } catch (error) {
    console.error('Reddit scraping error:', error);
    
    try {
      const { jobId } = await request.json();
      if (jobId) {
        await updateJobStatus(jobId, 'failed');
      }
    } catch (updateError) {
      console.error('Failed to update job status:', updateError);
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Reddit scraping and analysis failed', details: errorMessage },
      { status: 500 }
    );
  }
}
