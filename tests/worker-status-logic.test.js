/**
 * Worker Status Logic Tests
 * 
 * This file tests the critical status logic fixes for the persona app worker system.
 * 
 * Critical Issues Being Tested:
 * 1. Workers show green ONLY when returning actual data 
 * 2. Workers show yellow when completed but no data found
 * 3. Workers show red when failed with errors
 * 4. Status determination is consistent across all workers
 */

const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');

// Mock the worker functions for testing
class MockWebsiteCrawlerWorker {
  async process(params) {
    const { simulateScenario } = params;
    
    switch (simulateScenario) {
      case 'success_with_data':
        return {
          success: true,
          hasActualData: true,
          dataCollected: true,
          websiteData: {
            customerReviews: ['Amazing product!', 'Really works great'],
            features: ['Feature 1', 'Feature 2'],
            valuePropositions: ['Value 1'],
            painPointsAddressed: ['Pain 1'],
            testimonials: ['Testimonial 1'],
            brandMessaging: 'Great brand messaging here'
          },
          analysis: {
            reviewsFound: 2,
            featuresFound: 2,
            valuePropsFound: 1,
            painPointsFound: 1,
            hasActualData: true,
            dataQuality: 'good'
          },
          metadata: {
            hasActualData: true,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'success_no_data':
        return {
          success: true,
          hasActualData: false,
          dataCollected: false,
          websiteData: {
            customerReviews: [],
            features: [],
            valuePropositions: [],
            painPointsAddressed: [],
            testimonials: [],
            brandMessaging: ''
          },
          analysis: {
            reviewsFound: 0,
            featuresFound: 0,
            valuePropsFound: 0,
            painPointsFound: 0,
            hasActualData: false,
            dataQuality: 'empty_results'
          },
          metadata: {
            hasActualData: false,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'failure':
        throw new Error('Website crawler failed - network timeout');
        
      default:
        return this.process({ simulateScenario: 'success_with_data' });
    }
  }
}

class MockAmazonReviewsWorker {
  async process(params) {
    const { simulateScenario } = params;
    
    switch (simulateScenario) {
      case 'success_with_data':
        return {
          success: true,
          hasActualData: true,
          dataCollected: true,
          reviews: [
            { title: 'Great product', text: 'Really love this', rating: 5 },
            { title: 'Works well', text: 'Does what it says', rating: 4 }
          ],
          analysis: {
            totalReviews: 2,
            extractionStatus: 'SUCCESS',
            hasActualData: true,
            dataQuality: 'good'
          },
          metadata: {
            hasActualData: true,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'success_no_data':
        return {
          success: true,
          hasActualData: false,
          dataCollected: false,
          reviews: [],
          analysis: {
            totalReviews: 0,
            extractionStatus: 'NO_REVIEWS_FOUND',
            hasActualData: false,
            dataQuality: 'empty_results'
          },
          metadata: {
            hasActualData: false,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'failure':
        return {
          success: false,
          hasActualData: false,
          dataCollected: false,
          reviews: [],
          analysis: {
            totalReviews: 0,
            extractionStatus: 'FAILED',
            hasActualData: false,
            dataQuality: 'failed'
          },
          metadata: {
            error: 'Amazon extraction failed',
            hasActualData: false
          }
        };
        
      default:
        return this.process({ simulateScenario: 'success_with_data' });
    }
  }
}

class MockRedditScraperWorker {
  async process(params) {
    const { simulateScenario } = params;
    
    switch (simulateScenario) {
      case 'success_with_data':
        return {
          success: true,
          hasActualData: true,
          dataCollected: true,
          posts: [
            { title: 'Question about product', content: 'Has anyone tried this?' },
            { title: 'Review', content: 'Works great for me' }
          ],
          comments: [
            { text: 'Yes, I tried it and loved it' },
            { text: 'Not for me, but quality seems good' }
          ],
          analysis: {
            totalPosts: 2,
            totalComments: 2,
            hasActualData: true,
            dataQuality: 'good'
          },
          metadata: {
            hasActualData: true,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'success_no_data':
        return {
          success: true,
          hasActualData: false,
          dataCollected: false,
          posts: [],
          comments: [],
          analysis: {
            totalPosts: 0,
            totalComments: 0,
            hasActualData: false,
            dataQuality: 'empty_results'
          },
          metadata: {
            hasActualData: false,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'failure':
        return {
          success: false,
          hasActualData: false,
          dataCollected: false,
          posts: [],
          comments: [],
          analysis: {
            totalPosts: 0,
            totalComments: 0,
            hasActualData: false,
            dataQuality: 'failed'
          },
          metadata: {
            error: 'Reddit API failed',
            hasActualData: false
          }
        };
        
      default:
        return this.process({ simulateScenario: 'success_with_data' });
    }
  }
}

class MockYouTubeCommentsWorker {
  async process(params) {
    const { simulateScenario } = params;
    
    switch (simulateScenario) {
      case 'success_with_data':
        return {
          success: true,
          hasActualData: true,
          dataCollected: true,
          comments: [
            { text: 'This video helped me choose the product' },
            { text: 'Great review, very helpful' }
          ],
          analysis: {
            totalComments: 2,
            videosAnalyzed: 1,
            hasActualData: true,
            dataQuality: 'good'
          },
          metadata: {
            hasActualData: true,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'success_no_data':
        return {
          success: true,
          hasActualData: false,
          dataCollected: false,
          comments: [],
          analysis: {
            totalComments: 0,
            videosAnalyzed: 0,
            hasActualData: false,
            dataQuality: 'mock_empty'
          },
          metadata: {
            hasActualData: false,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'failure':
        throw new Error('YouTube API failed - quota exceeded');
        
      default:
        return this.process({ simulateScenario: 'success_with_data' });
    }
  }
}

class MockPersonaGeneratorWorker {
  async process(params) {
    const { simulateScenario } = params;
    
    switch (simulateScenario) {
      case 'success_with_data':
        const longPersona = `# STAGE 1: DEMOGRAPHICS FOUNDATION ANALYSIS
*Generated: ${new Date().toLocaleString()}*
*Data Quality Score: 85% (25 reviews analyzed)*

## Generated Persona Profile

**Name:** Sarah Thompson
**Age:** 35-45
**Title:** Informed Consumer

**Bio:** A research-oriented professional who values quality and authenticity. Based on analysis of 25 data points, this persona represents the primary customer segment interested in health products.

**Pain Points:**
• Struggling with sleep quality issues
• Looking for natural health solutions
• Frustrated with ineffective products from past purchases
• Need reliable product recommendations

**Goals:**
• Find effective health solutions
• Make informed purchasing decisions
• Achieve better sleep quality
• Access trustworthy product information

**Characteristics:**
• Research-oriented decision maker
• Values quality over price
• Reads reviews extensively
• Prefers natural products

**Demographics:**
- Income: $50,000 - $100,000
- Location: Urban/Suburban areas
- Education: College educated

This is a comprehensive persona analysis with substantial content and actionable insights.`;

        return {
          success: true,
          hasActualData: true,
          dataCollected: true,
          persona: longPersona,
          stage: 'demographics_foundation',
          stageNumber: 1,
          dataQuality: {
            confidence: 'high',
            score: 85
          },
          metadata: {
            hasActualData: true,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'success_no_data':
        return {
          success: true,
          hasActualData: false,
          dataCollected: false,
          persona: `# STAGE 1: DEMOGRAPHICS FOUNDATION ANALYSIS - LIMITED DATA

**Error:** Insufficient data available for comprehensive persona analysis.

**Data Available:**
- Amazon Reviews: 0 reviews
- Website Analysis: Not available
- YouTube Comments: 0 comments
- Reddit Posts: 0 posts

Unable to generate meaningful persona with available data.`,
          stage: 'demographics_foundation',
          stageNumber: 1,
          dataQuality: {
            confidence: 'low',
            score: 15
          },
          metadata: {
            hasActualData: false,
            timestamp: new Date().toISOString()
          }
        };
        
      case 'failure':
        throw new Error('Persona generator failed - OpenAI API rate limit exceeded');
        
      default:
        return this.process({ simulateScenario: 'success_with_data' });
    }
  }
}

// Status determination function - this is what we're testing
function determineWorkerStatus(workerResult, workerName) {
  // Handle failures first
  if (workerResult.error || workerResult.success === false) {
    return 'failed'; // Red status
  }
  
  // Check for actual data collection success
  if (workerResult.hasActualData === true || workerResult.dataCollected === true) {
    return 'completed'; // Green status
  }
  
  // Process completed but no meaningful data
  if (workerResult.hasActualData === false || workerResult.dataCollected === false) {
    return 'completed_no_data'; // Yellow status
  }
  
  // Default to completed for successful processes
  return 'completed';
}

// Tests start here
describe('Worker Status Logic Tests', () => {
  let websiteWorker, amazonWorker, redditWorker, youtubeWorker, personaWorker;
  
  beforeEach(() => {
    websiteWorker = new MockWebsiteCrawlerWorker();
    amazonWorker = new MockAmazonReviewsWorker();
    redditWorker = new MockRedditScraperWorker();
    youtubeWorker = new MockYouTubeCommentsWorker();
    personaWorker = new MockPersonaGeneratorWorker();
  });

  describe('Website Crawler Worker Status Logic', () => {
    it('should return GREEN status when meaningful data is collected', async () => {
      const result = await websiteWorker.process({ simulateScenario: 'success_with_data' });
      const status = determineWorkerStatus(result, 'website-crawler');
      
      assert.strictEqual(status, 'completed', 'Should return completed (green) status');
      assert.strictEqual(result.hasActualData, true, 'Should have hasActualData = true');
      assert.strictEqual(result.analysis.reviewsFound, 2, 'Should find 2 reviews');
      assert.strictEqual(result.analysis.featuresFound, 2, 'Should find 2 features');
    });

    it('should return YELLOW status when no meaningful data is found', async () => {
      const result = await websiteWorker.process({ simulateScenario: 'success_no_data' });
      const status = determineWorkerStatus(result, 'website-crawler');
      
      assert.strictEqual(status, 'completed_no_data', 'Should return completed_no_data (yellow) status');
      assert.strictEqual(result.hasActualData, false, 'Should have hasActualData = false');
      assert.strictEqual(result.analysis.reviewsFound, 0, 'Should find 0 reviews');
      assert.strictEqual(result.analysis.dataQuality, 'empty_results', 'Should have empty_results quality');
    });

    it('should return RED status when process fails', async () => {
      try {
        await websiteWorker.process({ simulateScenario: 'failure' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        const status = determineWorkerStatus({ error: error.message, success: false }, 'website-crawler');
        assert.strictEqual(status, 'failed', 'Should return failed (red) status');
        assert.ok(error.message.includes('network timeout'), 'Should have error message');
      }
    });
  });

  describe('Amazon Reviews Worker Status Logic', () => {
    it('should return GREEN status when reviews are successfully collected', async () => {
      const result = await amazonWorker.process({ simulateScenario: 'success_with_data' });
      const status = determineWorkerStatus(result, 'amazon-reviews');
      
      assert.strictEqual(status, 'completed', 'Should return completed (green) status');
      assert.strictEqual(result.hasActualData, true, 'Should have hasActualData = true');
      assert.strictEqual(result.reviews.length, 2, 'Should have 2 reviews');
      assert.strictEqual(result.analysis.extractionStatus, 'SUCCESS', 'Should have SUCCESS status');
    });

    it('should return YELLOW status when no reviews are found', async () => {
      const result = await amazonWorker.process({ simulateScenario: 'success_no_data' });
      const status = determineWorkerStatus(result, 'amazon-reviews');
      
      assert.strictEqual(status, 'completed_no_data', 'Should return completed_no_data (yellow) status');
      assert.strictEqual(result.hasActualData, false, 'Should have hasActualData = false');
      assert.strictEqual(result.reviews.length, 0, 'Should have 0 reviews');
      assert.strictEqual(result.analysis.extractionStatus, 'NO_REVIEWS_FOUND', 'Should have NO_REVIEWS_FOUND status');
    });

    it('should return RED status when extraction fails', async () => {
      const result = await amazonWorker.process({ simulateScenario: 'failure' });
      const status = determineWorkerStatus(result, 'amazon-reviews');
      
      assert.strictEqual(status, 'failed', 'Should return failed (red) status');
      assert.strictEqual(result.success, false, 'Should have success = false');
      assert.strictEqual(result.analysis.extractionStatus, 'FAILED', 'Should have FAILED status');
    });
  });

  describe('Reddit Scraper Worker Status Logic', () => {
    it('should return GREEN status when posts/comments are found', async () => {
      const result = await redditWorker.process({ simulateScenario: 'success_with_data' });
      const status = determineWorkerStatus(result, 'reddit-scraper');
      
      assert.strictEqual(status, 'completed', 'Should return completed (green) status');
      assert.strictEqual(result.hasActualData, true, 'Should have hasActualData = true');
      assert.strictEqual(result.posts.length, 2, 'Should have 2 posts');
      assert.strictEqual(result.comments.length, 2, 'Should have 2 comments');
    });

    it('should return YELLOW status when no posts/comments are found', async () => {
      const result = await redditWorker.process({ simulateScenario: 'success_no_data' });
      const status = determineWorkerStatus(result, 'reddit-scraper');
      
      assert.strictEqual(status, 'completed_no_data', 'Should return completed_no_data (yellow) status');
      assert.strictEqual(result.hasActualData, false, 'Should have hasActualData = false');
      assert.strictEqual(result.posts.length, 0, 'Should have 0 posts');
      assert.strictEqual(result.comments.length, 0, 'Should have 0 comments');
    });

    it('should return RED status when Reddit API fails', async () => {
      const result = await redditWorker.process({ simulateScenario: 'failure' });
      const status = determineWorkerStatus(result, 'reddit-scraper');
      
      assert.strictEqual(status, 'failed', 'Should return failed (red) status');
      assert.strictEqual(result.success, false, 'Should have success = false');
      assert.ok(result.metadata.error, 'Should have error in metadata');
    });
  });

  describe('YouTube Comments Worker Status Logic', () => {
    it('should return GREEN status when comments/videos are found', async () => {
      const result = await youtubeWorker.process({ simulateScenario: 'success_with_data' });
      const status = determineWorkerStatus(result, 'youtube-comments');
      
      assert.strictEqual(status, 'completed', 'Should return completed (green) status');
      assert.strictEqual(result.hasActualData, true, 'Should have hasActualData = true');
      assert.strictEqual(result.analysis.totalComments, 2, 'Should have 2 comments');
      assert.strictEqual(result.analysis.videosAnalyzed, 1, 'Should have analyzed 1 video');
    });

    it('should return YELLOW status when no comments/videos are found', async () => {
      const result = await youtubeWorker.process({ simulateScenario: 'success_no_data' });
      const status = determineWorkerStatus(result, 'youtube-comments');
      
      assert.strictEqual(status, 'completed_no_data', 'Should return completed_no_data (yellow) status');
      assert.strictEqual(result.hasActualData, false, 'Should have hasActualData = false');
      assert.strictEqual(result.analysis.totalComments, 0, 'Should have 0 comments');
      assert.strictEqual(result.analysis.videosAnalyzed, 0, 'Should have analyzed 0 videos');
    });

    it('should return RED status when YouTube API fails', async () => {
      try {
        await youtubeWorker.process({ simulateScenario: 'failure' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        const status = determineWorkerStatus({ error: error.message, success: false }, 'youtube-comments');
        assert.strictEqual(status, 'failed', 'Should return failed (red) status');
        assert.ok(error.message.includes('quota exceeded'), 'Should have quota error message');
      }
    });
  });

  describe('Persona Generator Worker Status Logic', () => {
    it('should return GREEN status when substantial persona content is generated', async () => {
      const result = await personaWorker.process({ simulateScenario: 'success_with_data' });
      const status = determineWorkerStatus(result, 'persona-generator');
      
      assert.strictEqual(status, 'completed', 'Should return completed (green) status');
      assert.strictEqual(result.hasActualData, true, 'Should have hasActualData = true');
      assert.ok(result.persona.length > 100, 'Should have substantial persona content (>100 chars)');
      assert.strictEqual(result.dataQuality.confidence, 'high', 'Should have high confidence');
      assert.ok(result.persona.includes('Sarah Thompson'), 'Should contain persona details');
    });

    it('should return YELLOW status when minimal content is generated', async () => {
      const result = await personaWorker.process({ simulateScenario: 'success_no_data' });
      const status = determineWorkerStatus(result, 'persona-generator');
      
      assert.strictEqual(status, 'completed_no_data', 'Should return completed_no_data (yellow) status');
      assert.strictEqual(result.hasActualData, false, 'Should have hasActualData = false');
      assert.ok(result.persona.includes('Insufficient data'), 'Should indicate insufficient data');
      assert.strictEqual(result.dataQuality.confidence, 'low', 'Should have low confidence');
    });

    it('should return RED status when persona generation fails', async () => {
      try {
        await personaWorker.process({ simulateScenario: 'failure' });
        assert.fail('Should have thrown an error');
      } catch (error) {
        const status = determineWorkerStatus({ error: error.message, success: false }, 'persona-generator');
        assert.strictEqual(status, 'failed', 'Should return failed (red) status');
        assert.ok(error.message.includes('rate limit exceeded'), 'Should have rate limit error message');
      }
    });
  });

  describe('Cross-Worker Status Consistency', () => {
    it('should consistently apply the same status logic across all workers', async () => {
      const workers = [
        { worker: websiteWorker, name: 'website-crawler' },
        { worker: amazonWorker, name: 'amazon-reviews' },
        { worker: redditWorker, name: 'reddit-scraper' },
        { worker: youtubeWorker, name: 'youtube-comments' },
        { worker: personaWorker, name: 'persona-generator' }
      ];

      // Test success with data scenario
      for (const { worker, name } of workers) {
        const result = await worker.process({ simulateScenario: 'success_with_data' });
        const status = determineWorkerStatus(result, name);
        assert.strictEqual(status, 'completed', `${name} should return green status for success with data`);
        assert.strictEqual(result.hasActualData, true, `${name} should have hasActualData = true`);
      }

      // Test success with no data scenario  
      for (const { worker, name } of workers) {
        const result = await worker.process({ simulateScenario: 'success_no_data' });
        const status = determineWorkerStatus(result, name);
        assert.strictEqual(status, 'completed_no_data', `${name} should return yellow status for no data`);
        assert.strictEqual(result.hasActualData, false, `${name} should have hasActualData = false`);
      }
    });
  });

  describe('Status Mapping for UI Display', () => {
    it('should map status values to correct UI colors', () => {
      const statusToColor = (status) => {
        switch (status) {
          case 'completed':
            return 'green';
          case 'completed_no_data':
            return 'yellow'; 
          case 'failed':
            return 'red';
          case 'processing':
            return 'blue';
          default:
            return 'gray';
        }
      };

      assert.strictEqual(statusToColor('completed'), 'green', 'Completed should be green');
      assert.strictEqual(statusToColor('completed_no_data'), 'yellow', 'No data should be yellow');
      assert.strictEqual(statusToColor('failed'), 'red', 'Failed should be red');
      assert.strictEqual(statusToColor('processing'), 'blue', 'Processing should be blue');
      assert.strictEqual(statusToColor('not_started'), 'gray', 'Not started should be gray');
    });
  });
});

console.log('Worker Status Logic Tests loaded. Run with: node --test tests/worker-status-logic.test.js');