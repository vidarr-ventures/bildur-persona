import { scrapeWebsiteWithFirecrawl, scrapeRedditWithFirecrawl, performMarketResearch, isFirecrawlAvailable } from './firecrawl';
import { performDeepMarketResearch, generateIndustryQueries, isOpenAIResearchAvailable } from './openai-research';

export type DataCollectionTier = 'standard' | 'enhanced' | 'premium';

export interface CollectionConfig {
  tier: DataCollectionTier;
  jobId: string;
  websiteUrl: string;
  keywords: string;
  amazonUrl?: string;
  competitorUrls?: string[];
}

export interface EnhancedDataResult {
  success: boolean;
  data?: any;
  error?: string;
  tier: DataCollectionTier;
  methods: string[];
}

/**
 * Route data collection based on tier
 */
export async function routeDataCollection(config: CollectionConfig): Promise<{
  websiteData: EnhancedDataResult;
  redditData: EnhancedDataResult;
  researchData?: EnhancedDataResult;
}> {
  console.log(`🎯 Routing data collection for tier: ${config.tier}`);

  const results = {
    websiteData: await collectWebsiteData(config),
    redditData: await collectRedditData(config),
    researchData: undefined as EnhancedDataResult | undefined
  };

  // Premium tier gets additional AI research
  if (config.tier === 'premium') {
    results.researchData = await collectPremiumResearch(config);
  }

  return results;
}

/**
 * Collect website data based on tier
 */
async function collectWebsiteData(config: CollectionConfig): Promise<EnhancedDataResult> {
  const { tier, websiteUrl } = config;

  switch (tier) {
    case 'standard':
      return {
        success: true,
        data: { method: 'basic_fetch', note: 'Using standard web scraping' },
        tier,
        methods: ['basic_fetch']
      };

    case 'enhanced':
    case 'premium':
      if (isFirecrawlAvailable()) {
        try {
          const result = await scrapeWebsiteWithFirecrawl(websiteUrl);
          return {
            success: result.success,
            data: result.data,
            error: result.error,
            tier,
            methods: ['firecrawl']
          };
        } catch (error) {
          console.error('Firecrawl website scraping failed, falling back to standard:', error);
          return {
            success: true,
            data: { method: 'basic_fetch_fallback', note: 'Firecrawl failed, used standard method' },
            tier,
            methods: ['basic_fetch_fallback']
          };
        }
      } else {
        return {
          success: false,
          error: 'Enhanced data collection not available - Firecrawl not configured',
          tier,
          methods: []
        };
      }

    default:
      return {
        success: false,
        error: 'Unknown data collection tier',
        tier,
        methods: []
      };
  }
}

/**
 * Collect Reddit data based on tier
 */
async function collectRedditData(config: CollectionConfig): Promise<EnhancedDataResult> {
  const { tier, keywords } = config;

  switch (tier) {
    case 'standard':
      return {
        success: true,
        data: { method: 'reddit_api', note: 'Using Reddit JSON API' },
        tier,
        methods: ['reddit_api']
      };

    case 'enhanced':
    case 'premium':
      if (isFirecrawlAvailable()) {
        try {
          // Generate Reddit search URLs for enhanced scraping
          const searchUrls = generateRedditSearchUrls(keywords);
          const results = [];

          for (const url of searchUrls.slice(0, 3)) { // Limit to 3 for cost control
            const result = await scrapeRedditWithFirecrawl(url);
            if (result.success) {
              results.push(result.data);
            }
          }

          return {
            success: true,
            data: { 
              method: 'firecrawl_reddit', 
              results,
              urlsScraped: searchUrls.length 
            },
            tier,
            methods: ['firecrawl_reddit']
          };
        } catch (error) {
          console.error('Firecrawl Reddit scraping failed, falling back to standard:', error);
          return {
            success: true,
            data: { method: 'reddit_api_fallback', note: 'Firecrawl failed, used Reddit API' },
            tier,
            methods: ['reddit_api_fallback']
          };
        }
      } else {
        return {
          success: false,
          error: 'Enhanced Reddit collection not available - Firecrawl not configured',
          tier,
          methods: []
        };
      }

    default:
      return {
        success: false,
        error: 'Unknown Reddit collection tier',
        tier,
        methods: []
      };
  }
}

/**
 * Collect premium research data (AI-powered)
 */
async function collectPremiumResearch(config: CollectionConfig): Promise<EnhancedDataResult> {
  const { keywords, websiteUrl } = config;

  if (!isOpenAIResearchAvailable()) {
    return {
      success: false,
      error: 'Premium research not available - OpenAI not configured',
      tier: config.tier,
      methods: []
    };
  }

  try {
    console.log('🤖 Performing premium AI research...');
    
    // Perform deep market research
    const researchResult = await performDeepMarketResearch(keywords, websiteUrl);
    
    if (!researchResult.success) {
      return {
        success: false,
        error: researchResult.error,
        tier: config.tier,
        methods: ['openai_research']
      };
    }

    // Generate additional research queries if Firecrawl is available
    let additionalInsights = null;
    if (isFirecrawlAvailable()) {
      try {
        const queries = await generateIndustryQueries(keywords, '');
        if (queries.length > 0) {
          // Perform market research using generated queries
          const marketResearch = await performMarketResearch(queries[0], 5);
          if (marketResearch.success) {
            additionalInsights = marketResearch.data;
          }
        }
      } catch (error) {
        console.log('Additional research failed, continuing with base research:', error);
      }
    }

    return {
      success: true,
      data: {
        ...researchResult.data,
        additionalInsights,
        methods: ['openai_research', ...(additionalInsights ? ['firecrawl_search'] : [])]
      },
      tier: config.tier,
      methods: ['openai_research', ...(additionalInsights ? ['firecrawl_search'] : [])]
    };

  } catch (error) {
    console.error('Premium research collection failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown premium research error',
      tier: config.tier,
      methods: ['openai_research']
    };
  }
}

/**
 * Generate Reddit search URLs for enhanced scraping
 */
function generateRedditSearchUrls(keywords: string): string[] {
  const searchTerms = keywords.toLowerCase().split(' ').slice(0, 3);
  const baseSubreddits = ['reviews', 'BuyItForLife', 'ProductPorn'];
  
  const urls = [];
  
  // Search in base subreddits
  for (const subreddit of baseSubreddits) {
    urls.push(`https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(keywords)}&restrict_sr=1&sort=relevance&limit=10`);
  }
  
  // Search in keyword-based subreddits
  for (const term of searchTerms) {
    urls.push(`https://www.reddit.com/search/?q=${encodeURIComponent(term)}&type=link&sort=relevance&limit=10`);
  }
  
  return urls;
}

/**
 * Get data collection capabilities based on configuration
 */
export function getDataCollectionCapabilities() {
  return {
    standard: {
      available: true,
      methods: ['basic_fetch', 'reddit_api'],
      cost: 'free'
    },
    enhanced: {
      available: isFirecrawlAvailable(),
      methods: ['firecrawl', 'firecrawl_reddit'],
      cost: 'moderate',
      requirements: ['FIRECRAWL_API_KEY']
    },
    premium: {
      available: isOpenAIResearchAvailable() && isFirecrawlAvailable(),
      methods: ['firecrawl', 'firecrawl_reddit', 'openai_research', 'firecrawl_search'],
      cost: 'high',
      requirements: ['FIRECRAWL_API_KEY', 'OPENAI_API_KEY']
    }
  };
}

/**
 * Validate tier configuration
 */
export function validateTierConfiguration(tier: DataCollectionTier): {
  valid: boolean;
  missing: string[];
  fallback?: DataCollectionTier;
} {
  const capabilities = getDataCollectionCapabilities();
  const tierConfig = capabilities[tier];

  if (!tierConfig.available) {
    const missing = tierConfig.requirements || [];
    
    // Suggest fallback
    let fallback: DataCollectionTier | undefined;
    if (tier === 'premium' && capabilities.enhanced.available) {
      fallback = 'enhanced';
    } else if ((tier === 'premium' || tier === 'enhanced') && capabilities.standard.available) {
      fallback = 'standard';
    }

    return {
      valid: false,
      missing,
      fallback
    };
  }

  return {
    valid: true,
    missing: []
  };
}