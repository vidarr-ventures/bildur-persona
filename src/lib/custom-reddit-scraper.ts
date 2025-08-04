/**
 * Custom Reddit Scraper
 * Replaces Firecrawl for cost optimization
 * Uses Reddit's JSON API and basic HTTP requests
 */

interface RedditPost {
  id: string;
  title: string;
  text: string;
  author: string;
  score: number;
  num_comments: number;
  created_utc: number;
  subreddit: string;
  url: string;
  permalink: string;
}

interface RedditComment {
  id: string;
  text: string;
  author: string;
  score: number;
  created_utc: number;
  parent_id: string;
}

interface RedditScrapingResult {
  success: boolean;
  posts: RedditPost[];
  comments: RedditComment[];
  metadata: {
    extraction_method: string;
    processing_time: number;
    subreddits_searched: string[];
    queries_used: string[];
    total_results: number;
    cost_savings: string;
  };
  error?: string;
}

export class CustomRedditScraper {
  private readonly maxRetries = 3;
  private readonly delayBetweenRequests = 1500; // 1.5 seconds to be respectful
  private readonly userAgent = 'CustomPersonaBot/1.0 (by /u/PersonaAnalyzer)';

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'application/json',
          }
        });

        if (response.ok) {
          return response;
        }

        if (response.status === 429) {
          const waitTime = attempt * 10000; // Exponential backoff
          console.log(`Reddit rate limited, waiting ${waitTime/1000}s before retry ${attempt}/${this.maxRetries}`);
          await this.delay(waitTime);
          continue;
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        console.error(`Reddit fetch attempt ${attempt} failed:`, error);
        if (attempt === this.maxRetries) {
          throw error;
        }
        await this.delay(attempt * 3000);
      }
    }
    throw new Error('Max retries exceeded');
  }

  private generateSearchQueries(keywords: string): string[] {
    const mainKeywords = keywords.toLowerCase().split(' ').filter(k => k.length > 2);
    const queries = [
      keywords, // Full keyword phrase
      ...mainKeywords, // Individual keywords
      `"${keywords}"`, // Exact phrase
      keywords + ' review',
      keywords + ' experience',
      keywords + ' worth it',
      keywords + ' quality'
    ];
    
    return [...new Set(queries)]; // Remove duplicates
  }

  private getTargetSubreddits(keywords: string): string[] {
    const lowerKeywords = keywords.toLowerCase();
    
    // Base subreddits for reviews and discussions
    const baseSubreddits = [
      'reviews',
      'BuyItForLife',
      'ProductPorn',
      'shutupandtakemymoney',
      'amazonreviews',
      'ProductHunters'
    ];

    // Category-specific subreddits based on keywords
    const categorySubreddits: { [key: string]: string[] } = {
      'sheets': ['BedSheets', 'sleep', 'bedding'],
      'grounding': ['earthing', 'barefoot', 'naturalhealth'],
      'health': ['health', 'wellness', 'alternativehealth'],
      'organic': ['organic', 'naturalhealth', 'zerowaste'],
      'cotton': ['organic', 'sustainability', 'zerowaste'],
      'sleep': ['sleep', 'insomnia', 'sleephygiene'],
      'bed': ['bedroom', 'sleep', 'BedSheets'],
      'home': ['HomeImprovement', 'InteriorDesign', 'homeowners'],
      'tech': ['technology', 'gadgets', 'BuyItForLife'],
      'fitness': ['fitness', 'health', 'wellness'],
      'beauty': ['SkincareAddicts', 'beauty', 'MakeupAddiction'],
      'food': ['food', 'cooking', 'nutrition']
    };

    // Add relevant category subreddits
    const relevantSubreddits = [...baseSubreddits];
    for (const [category, subreddits] of Object.entries(categorySubreddits)) {
      if (lowerKeywords.includes(category)) {
        relevantSubreddits.push(...subreddits);
      }
    }

    return [...new Set(relevantSubreddits)]; // Remove duplicates
  }

  private parseRedditPost(postData: any): RedditPost {
    return {
      id: postData.id,
      title: postData.title || '',
      text: postData.selftext || '',
      author: postData.author || '[deleted]',
      score: postData.score || 0,
      num_comments: postData.num_comments || 0,
      created_utc: postData.created_utc || 0,
      subreddit: postData.subreddit,
      url: postData.url || '',
      permalink: `https://reddit.com${postData.permalink}`
    };
  }

  private parseRedditComment(commentData: any): RedditComment {
    return {
      id: commentData.id,
      text: commentData.body || '',
      author: commentData.author || '[deleted]',
      score: commentData.score || 0,
      created_utc: commentData.created_utc || 0,
      parent_id: commentData.parent_id || ''
    };
  }

  private async searchSubreddit(subreddit: string, query: string, limit: number = 10): Promise<{posts: RedditPost[], comments: RedditComment[]}> {
    try {
      // Search posts in subreddit
      const searchUrl = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=1&limit=${limit}&sort=relevance`;
      
      console.log(`🔍 Searching r/${subreddit} for "${query}"`);
      
      const response = await this.fetchWithRetry(searchUrl);
      const data = await response.json();

      const posts: RedditPost[] = [];
      const comments: RedditComment[] = [];

      if (data.data && data.data.children) {
        for (const child of data.data.children) {
          if (child.kind === 't3') { // Post
            const post = this.parseRedditPost(child.data);
            if (post.title.length > 5 || post.text.length > 20) {
              posts.push(post);
            }
          }
        }

        // Get comments from top posts
        for (const post of posts.slice(0, 3)) {
          try {
            await this.delay(1000); // Be respectful
            const commentsUrl = `https://www.reddit.com${post.permalink.replace('https://reddit.com', '')}.json?limit=5`;
            const commentsResponse = await this.fetchWithRetry(commentsUrl);
            const commentsData = await commentsResponse.json();

            if (Array.isArray(commentsData) && commentsData[1] && commentsData[1].data) {
              for (const commentChild of commentsData[1].data.children) {
                if (commentChild.kind === 't1' && commentChild.data.body) {
                  const comment = this.parseRedditComment(commentChild.data);
                  if (comment.text.length > 20 && !comment.text.includes('[deleted]')) {
                    comments.push(comment);
                  }
                }
              }
            }
          } catch (commentError) {
            console.warn(`Failed to get comments for post ${post.id}:`, commentError);
          }
        }
      }

      console.log(`✅ r/${subreddit}: Found ${posts.length} posts, ${comments.length} comments`);
      return { posts, comments };

    } catch (error) {
      console.warn(`⚠️ Failed to search r/${subreddit}:`, error);
      return { posts: [], comments: [] };
    }
  }

  async scrapeRedditDiscussions(keywords: string, maxResults: number = 50): Promise<RedditScrapingResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔍 Starting custom Reddit scraping for: "${keywords}"`);
      
      const queries = this.generateSearchQueries(keywords);
      const subreddits = this.getTargetSubreddits(keywords);
      
      console.log(`📋 Searching ${subreddits.length} subreddits with ${queries.length} queries`);
      console.log(`🎯 Target subreddits: ${subreddits.slice(0, 5).join(', ')}${subreddits.length > 5 ? '...' : ''}`);

      let allPosts: RedditPost[] = [];
      let allComments: RedditComment[] = [];
      const searchedSubreddits: string[] = [];

      // Search each subreddit with the most relevant queries
      const maxSubredditsToSearch = Math.min(5, subreddits.length); // Limit to avoid rate limits
      
      for (let i = 0; i < maxSubredditsToSearch && allPosts.length < maxResults; i++) {
        const subreddit = subreddits[i];
        const primaryQuery = queries[0]; // Use main keywords for primary search
        
        try {
          const results = await this.searchSubreddit(subreddit, primaryQuery, 8);
          allPosts.push(...results.posts);
          allComments.push(...results.comments);
          searchedSubreddits.push(subreddit);
          
          // Delay between subreddit searches
          if (i < maxSubredditsToSearch - 1) {
            await this.delay(this.delayBetweenRequests);
          }
        } catch (error) {
          console.warn(`Failed to search r/${subreddit}:`, error);
        }
      }

      // If we need more results, try general search
      if (allPosts.length < maxResults * 0.5) {
        try {
          console.log('🌐 Performing general Reddit search...');
          const generalSearchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keywords)}&limit=20&sort=relevance`;
          const response = await this.fetchWithRetry(generalSearchUrl);
          const data = await response.json();

          if (data.data && data.data.children) {
            for (const child of data.data.children) {
              if (child.kind === 't3') {
                const post = this.parseRedditPost(child.data);
                if (post.title.length > 5 || post.text.length > 20) {
                  allPosts.push(post);
                }
              }
            }
          }
        } catch (generalError) {
          console.warn('General Reddit search failed:', generalError);
        }
      }

      // Remove duplicates and limit results
      const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values())
        .slice(0, maxResults);
      const uniqueComments = Array.from(new Map(allComments.map(c => [c.id, c])).values())
        .slice(0, maxResults * 2);

      const processingTime = Date.now() - startTime;
      const totalResults = uniquePosts.length + uniqueComments.length;

      console.log(`🎉 Reddit scraping complete: ${uniquePosts.length} posts, ${uniqueComments.length} comments in ${processingTime}ms`);

      return {
        success: true,
        posts: uniquePosts,
        comments: uniqueComments,
        metadata: {
          extraction_method: 'custom_reddit_scraper',
          processing_time: processingTime,
          subreddits_searched: searchedSubreddits,
          queries_used: queries.slice(0, 3),
          total_results: totalResults,
          cost_savings: 'Eliminated Firecrawl costs (~$0.30-1.00 per job)'
        }
      };

    } catch (error) {
      console.error('❌ Reddit scraping failed:', error);
      
      return {
        success: false,
        posts: [],
        comments: [],
        metadata: {
          extraction_method: 'custom_reddit_scraper',
          processing_time: Date.now() - startTime,
          subreddits_searched: [],
          queries_used: [],
          total_results: 0,
          cost_savings: 'Eliminated Firecrawl costs'
        },
        error: error instanceof Error ? error.message : 'Unknown scraping error'
      };
    }
  }
}

// Export singleton instance
export const customRedditScraper = new CustomRedditScraper();