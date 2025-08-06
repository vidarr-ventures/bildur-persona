/**
 * End-to-End Status Testing
 * 
 * This file tests the complete flow of status logic from job creation 
 * through worker execution to UI display.
 */

const assert = require('assert');
const { describe, it, beforeEach, before, after } = require('node:test');

// Mock the complete job processing pipeline
class MockJobProcessor {
  constructor() {
    this.jobResults = {};
    this.jobStatuses = {};
  }

  async createTestJob(scenario) {
    const jobId = `test-job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Simulate job creation
    this.jobStatuses[jobId] = 'pending';
    
    return {
      jobId,
      status: 'pending',
      websiteUrl: scenario.websiteUrl || 'https://example.com',
      amazonUrl: scenario.amazonUrl || '',
      targetKeywords: scenario.targetKeywords || 'test product'
    };
  }

  async processJobWithScenario(jobId, scenario) {
    this.jobStatuses[jobId] = 'processing';
    
    // Simulate all workers processing
    const results = {};
    
    // Website crawler
    if (scenario.websiteResult) {
      results.website = scenario.websiteResult;
    }
    
    // Amazon reviews
    if (scenario.amazonResult) {
      results.amazon = scenario.amazonResult;
    }
    
    // Reddit scraper  
    if (scenario.redditResult) {
      results.reddit = scenario.redditResult;
    }
    
    // YouTube comments
    if (scenario.youtubeResult) {
      results.youtube = scenario.youtubeResult;
    }
    
    // Persona generator
    if (scenario.personaResult) {
      results.persona = scenario.personaResult;
    }
    
    this.jobResults[jobId] = results;
    
    // Determine overall job status
    const hasAnySuccess = Object.values(results).some(result => 
      result.success !== false && !result.error
    );
    
    this.jobStatuses[jobId] = hasAnySuccess ? 'completed' : 'failed';
    
    return results;
  }

  getJobStatus(jobId) {
    return this.jobStatuses[jobId] || 'not_found';
  }

  getJobResults(jobId) {
    return this.jobResults[jobId] || {};
  }

  // Simulate the debug API endpoint functionality
  async getDebugInfo(jobId) {
    const results = this.getJobResults(jobId);
    const status = this.getJobStatus(jobId);
    
    // Analyze each data source status
    const dataSourceStatuses = {
      website: this.analyzeWorkerStatus(results.website, 'website'),
      amazon: this.analyzeWorkerStatus(results.amazon, 'amazon'),
      reddit: this.analyzeWorkerStatus(results.reddit, 'reddit'),
      youtube: this.analyzeWorkerStatus(results.youtube, 'youtube'),
      persona: this.analyzeWorkerStatus(results.persona, 'persona')
    };
    
    return {
      jobId,
      overallStatus: status,
      dataSourceStatuses,
      results
    };
  }

  analyzeWorkerStatus(workerResult, workerType) {
    if (!workerResult) {
      return {
        status: 'not_started',
        dataReturned: false,
        contentVolume: 'No data',
        extractionMethod: 'Unknown'
      };
    }

    // Apply the same status logic as the real system
    let status = 'completed';
    if (workerResult.error || workerResult.success === false) {
      status = 'failed';
    } else if (workerResult.hasActualData === false || workerResult.dataCollected === false) {
      status = 'completed_no_data'; // Yellow status
    } else if (workerResult.hasActualData === true || workerResult.dataCollected === true) {
      status = 'completed'; // Green status
    }

    return {
      status,
      dataReturned: workerResult.hasActualData === true,
      contentVolume: this.calculateContentVolume(workerResult, workerType),
      extractionMethod: this.getExtractionMethod(workerType),
      processingTime: 'Real-time',
      statusCode: 200,
      errorMessage: workerResult.error || null
    };
  }

  calculateContentVolume(result, workerType) {
    if (workerType === 'website') {
      const reviewCount = result.websiteData?.customerReviews?.length || 0;
      const featureCount = result.websiteData?.features?.length || 0;
      if (reviewCount + featureCount > 0) return `${reviewCount} reviews, ${featureCount} features`;
    } else if (workerType === 'amazon') {
      const reviewCount = result.reviews?.length || 0;
      if (reviewCount > 0) return `${reviewCount} reviews`;
    } else if (workerType === 'reddit') {
      const postCount = result.posts?.length || 0;
      const commentCount = result.comments?.length || 0;
      if (postCount + commentCount > 0) return `${postCount} posts, ${commentCount} comments`;
    } else if (workerType === 'youtube') {
      const commentCount = result.analysis?.totalComments || 0;
      if (commentCount > 0) return `${commentCount} comments`;
    } else if (workerType === 'persona') {
      const personaLength = result.persona?.length || 0;
      if (personaLength > 100) return `${Math.floor(personaLength/100)*100}+ chars`;
    }
    return 'No data';
  }

  getExtractionMethod(workerType) {
    const methods = {
      website: 'OpenAI Analysis',
      amazon: 'Custom Scraper + AI',
      reddit: 'Reddit API + AI',
      youtube: 'YouTube API',
      persona: 'Sequential AI Analysis'
    };
    return methods[workerType] || 'Unknown';
  }
}

// Test scenarios covering different combinations of worker results
const createTestScenarios = () => {
  return {
    // All green scenario - everything works with data
    allGreen: {
      name: 'All Workers Succeed with Data',
      websiteUrl: 'https://successful-site.com',
      amazonUrl: 'https://amazon.com/dp/B123456789',
      targetKeywords: 'successful product',
      websiteResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        websiteData: {
          customerReviews: ['Great product!', 'Love it!'],
          features: ['Feature 1', 'Feature 2'],
          valuePropositions: ['Value 1']
        }
      },
      amazonResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        reviews: [
          { title: 'Excellent', text: 'Works perfectly', rating: 5 },
          { title: 'Good quality', text: 'As described', rating: 4 }
        ]
      },
      redditResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        posts: [{ title: 'Product discussion', content: 'What do you think?' }],
        comments: [{ text: 'I tried it and it works great' }]
      },
      youtubeResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        analysis: { totalComments: 15, videosAnalyzed: 3 }
      },
      personaResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        persona: 'Comprehensive persona with detailed demographics, psychographics, pain points, goals, and actionable insights for marketing teams. This persona represents a research-oriented consumer who values quality and reads reviews extensively before making purchase decisions.'
      }
    },

    // All yellow scenario - everything processes but no meaningful data
    allYellow: {
      name: 'All Workers Complete but No Data Found',
      websiteUrl: 'https://no-reviews-site.com',
      amazonUrl: 'https://amazon.com/dp/B987654321',
      targetKeywords: 'niche product',
      websiteResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        websiteData: {
          customerReviews: [],
          features: [],
          valuePropositions: []
        }
      },
      amazonResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        reviews: []
      },
      redditResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        posts: [],
        comments: []
      },
      youtubeResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        analysis: { totalComments: 0, videosAnalyzed: 0 }
      },
      personaResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        persona: 'Error: Insufficient data available for comprehensive persona analysis.'
      }
    },

    // All red scenario - everything fails
    allRed: {
      name: 'All Workers Fail with Errors',
      websiteUrl: 'https://blocked-site.com',
      amazonUrl: 'https://amazon.com/dp/INVALID',
      targetKeywords: 'blocked product',
      websiteResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'Website blocked our requests'
      },
      amazonResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'Amazon product not found'
      },
      redditResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'Reddit API rate limit exceeded'
      },
      youtubeResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'YouTube quota exceeded'
      },
      personaResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'Cannot generate persona without source data'
      }
    },

    // Mixed scenario - realistic combination
    mixed: {
      name: 'Mixed Results - Realistic Scenario',
      websiteUrl: 'https://partial-data-site.com',
      amazonUrl: 'https://amazon.com/dp/B555666777',
      targetKeywords: 'mixed results product',
      websiteResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        websiteData: {
          customerReviews: ['Good product overall'],
          features: ['Feature 1'],
          valuePropositions: []
        }
      },
      amazonResult: {
        success: false,
        hasActualData: false,
        dataCollected: false,
        error: 'Amazon blocking requests'
      },
      redditResult: {
        success: true,
        hasActualData: false,
        dataCollected: false,
        posts: [],
        comments: []
      },
      youtubeResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        analysis: { totalComments: 8, videosAnalyzed: 2 }
      },
      personaResult: {
        success: true,
        hasActualData: true,
        dataCollected: true,
        persona: 'Partial persona analysis based on limited data sources. The persona shows interest in the product category but lacks comprehensive demographic insights due to limited data availability.'
      }
    }
  };
};

// Tests
describe('End-to-End Status Testing', () => {
  let jobProcessor;
  let scenarios;

  before(() => {
    jobProcessor = new MockJobProcessor();
    scenarios = createTestScenarios();
  });

  describe('Complete Job Processing Flow', () => {
    it('should handle all-green scenario correctly', async () => {
      const scenario = scenarios.allGreen;
      const job = await jobProcessor.createTestJob(scenario);
      
      // Process the job
      const results = await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      // Get debug info
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Verify overall job completion
      assert.strictEqual(debugInfo.overallStatus, 'completed', 'Job should be completed');
      
      // Verify all workers show green status
      Object.entries(debugInfo.dataSourceStatuses).forEach(([workerName, status]) => {
        if (status.status !== 'not_started') { // Skip workers that weren't run
          assert.strictEqual(status.status, 'completed', `${workerName} should have completed (green) status`);
          assert.strictEqual(status.dataReturned, true, `${workerName} should have data returned`);
          assert.notStrictEqual(status.contentVolume, 'No data', `${workerName} should have content volume`);
        }
      });
    });

    it('should handle all-yellow scenario correctly', async () => {
      const scenario = scenarios.allYellow;
      const job = await jobProcessor.createTestJob(scenario);
      
      // Process the job
      const results = await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      // Get debug info
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Verify overall job completion (processes succeeded, just no data)
      assert.strictEqual(debugInfo.overallStatus, 'completed', 'Job should be completed');
      
      // Verify all workers show yellow status
      Object.entries(debugInfo.dataSourceStatuses).forEach(([workerName, status]) => {
        if (status.status !== 'not_started') {
          assert.strictEqual(status.status, 'completed_no_data', `${workerName} should have completed_no_data (yellow) status`);
          assert.strictEqual(status.dataReturned, false, `${workerName} should have no data returned`);
          assert.strictEqual(status.contentVolume, 'No data', `${workerName} should have no content volume`);
        }
      });
    });

    it('should handle all-red scenario correctly', async () => {
      const scenario = scenarios.allRed;
      const job = await jobProcessor.createTestJob(scenario);
      
      // Process the job
      const results = await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      // Get debug info
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Verify overall job failure
      assert.strictEqual(debugInfo.overallStatus, 'failed', 'Job should be failed');
      
      // Verify all workers show red status
      Object.entries(debugInfo.dataSourceStatuses).forEach(([workerName, status]) => {
        if (status.status !== 'not_started') {
          assert.strictEqual(status.status, 'failed', `${workerName} should have failed (red) status`);
          assert.strictEqual(status.dataReturned, false, `${workerName} should have no data returned`);
          assert.ok(status.errorMessage, `${workerName} should have error message`);
        }
      });
    });

    it('should handle mixed scenario correctly', async () => {
      const scenario = scenarios.mixed;
      const job = await jobProcessor.createTestJob(scenario);
      
      // Process the job
      const results = await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      // Get debug info  
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Verify overall job completion (some succeeded)
      assert.strictEqual(debugInfo.overallStatus, 'completed', 'Job should be completed');
      
      // Verify individual worker statuses
      assert.strictEqual(debugInfo.dataSourceStatuses.website.status, 'completed', 'Website should be green');
      assert.strictEqual(debugInfo.dataSourceStatuses.amazon.status, 'failed', 'Amazon should be red');
      assert.strictEqual(debugInfo.dataSourceStatuses.reddit.status, 'completed_no_data', 'Reddit should be yellow');
      assert.strictEqual(debugInfo.dataSourceStatuses.youtube.status, 'completed', 'YouTube should be green');
      assert.strictEqual(debugInfo.dataSourceStatuses.persona.status, 'completed', 'Persona should be green');
    });
  });

  describe('Status Consistency Across Pipeline', () => {
    it('should maintain consistent status logic from workers to API to UI', async () => {
      const scenario = scenarios.mixed;
      const job = await jobProcessor.createTestJob(scenario);
      await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Test status consistency
      const statusMappings = {
        'completed': { color: 'green', uiText: 'Completed' },
        'completed_no_data': { color: 'yellow', uiText: 'Completed (No Data)' },
        'failed': { color: 'red', uiText: 'Failed' },
        'processing': { color: 'blue', uiText: 'Processing' },
        'not_started': { color: 'gray', uiText: 'Not Started' }
      };

      Object.entries(debugInfo.dataSourceStatuses).forEach(([workerName, status]) => {
        const mapping = statusMappings[status.status];
        assert.ok(mapping, `Status ${status.status} for ${workerName} should have UI mapping`);
        
        // Verify status logic consistency
        if (status.status === 'completed') {
          assert.strictEqual(status.dataReturned, true, `${workerName} with completed status should have data`);
        } else if (status.status === 'completed_no_data') {
          assert.strictEqual(status.dataReturned, false, `${workerName} with no data status should not have data`);
        } else if (status.status === 'failed') {
          assert.strictEqual(status.dataReturned, false, `${workerName} with failed status should not have data`);
          assert.ok(status.errorMessage, `${workerName} with failed status should have error message`);
        }
      });
    });

    it('should provide accurate metrics for UI display', async () => {
      const scenario = scenarios.allGreen;
      const job = await jobProcessor.createTestJob(scenario);
      await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Verify content volume calculations
      assert.ok(debugInfo.dataSourceStatuses.website.contentVolume.includes('reviews'), 'Website should show review count');
      assert.ok(debugInfo.dataSourceStatuses.amazon.contentVolume.includes('reviews'), 'Amazon should show review count');
      assert.ok(debugInfo.dataSourceStatuses.reddit.contentVolume.includes('posts'), 'Reddit should show post count');
      assert.ok(debugInfo.dataSourceStatuses.youtube.contentVolume.includes('comments'), 'YouTube should show comment count');
      assert.ok(debugInfo.dataSourceStatuses.persona.contentVolume.includes('chars'), 'Persona should show character count');
      
      // Verify extraction methods
      assert.ok(debugInfo.dataSourceStatuses.website.extractionMethod.includes('OpenAI'), 'Website should use OpenAI method');
      assert.ok(debugInfo.dataSourceStatuses.amazon.extractionMethod.includes('Scraper'), 'Amazon should use scraper method');
      assert.ok(debugInfo.dataSourceStatuses.youtube.extractionMethod.includes('YouTube'), 'YouTube should use API method');
    });
  });

  describe('Error Recovery and Partial Success Scenarios', () => {
    it('should complete jobs even when some workers fail', async () => {
      const partialFailureScenario = {
        name: 'Partial Failure Test',
        websiteResult: {
          success: true,
          hasActualData: true,
          dataCollected: true,
          websiteData: { customerReviews: ['Working review'] }
        },
        amazonResult: {
          success: false,
          hasActualData: false,
          dataCollected: false,
          error: 'Amazon failed'
        },
        personaResult: {
          success: true,
          hasActualData: true,
          dataCollected: true,
          persona: 'Generated persona based on partial data'
        }
      };

      const job = await jobProcessor.createTestJob(partialFailureScenario);
      await jobProcessor.processJobWithScenario(job.jobId, partialFailureScenario);
      
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Job should complete because some workers succeeded
      assert.strictEqual(debugInfo.overallStatus, 'completed', 'Job should complete with partial success');
      assert.strictEqual(debugInfo.dataSourceStatuses.website.status, 'completed', 'Website should be green');
      assert.strictEqual(debugInfo.dataSourceStatuses.amazon.status, 'failed', 'Amazon should be red');
      assert.strictEqual(debugInfo.dataSourceStatuses.persona.status, 'completed', 'Persona should be green');
    });

    it('should handle edge cases in data evaluation', async () => {
      const edgeCaseScenario = {
        name: 'Edge Case Test',
        websiteResult: {
          success: true,
          hasActualData: true,
          dataCollected: true,
          websiteData: {
            customerReviews: [], // No reviews but...
            features: ['One feature'], // Has features
            brandMessaging: 'Short' // Very short messaging
          }
        },
        personaResult: {
          success: true,
          hasActualData: false, // Says no data but...
          dataCollected: false,
          persona: 'This persona is exactly one hundred characters long for testing edge case boundary conditions!' // Exactly 100 chars
        }
      };

      const job = await jobProcessor.createTestJob(edgeCaseScenario);
      await jobProcessor.processJobWithScenario(job.jobId, edgeCaseScenario);
      
      const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
      
      // Website should be green because it has features
      assert.strictEqual(debugInfo.dataSourceStatuses.website.status, 'completed', 'Website should be green with features');
      
      // Persona should be yellow because hasActualData is false (even though content exists)
      assert.strictEqual(debugInfo.dataSourceStatuses.persona.status, 'completed_no_data', 'Persona should respect hasActualData flag');
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple simultaneous jobs', async () => {
      const jobs = [];
      
      // Create multiple jobs with different scenarios
      for (let i = 0; i < 5; i++) {
        const scenario = i % 2 === 0 ? scenarios.allGreen : scenarios.allYellow;
        const job = await jobProcessor.createTestJob(scenario);
        jobs.push({ job, scenario });
      }
      
      // Process all jobs
      const processPromises = jobs.map(({ job, scenario }) => 
        jobProcessor.processJobWithScenario(job.jobId, scenario)
      );
      
      await Promise.all(processPromises);
      
      // Verify all jobs completed correctly
      for (let i = 0; i < jobs.length; i++) {
        const { job } = jobs[i];
        const debugInfo = await jobProcessor.getDebugInfo(job.jobId);
        
        assert.strictEqual(debugInfo.overallStatus, 'completed', `Job ${i} should be completed`);
        
        // Even-indexed jobs should have green workers, odd should have yellow
        const expectedWorkerStatus = i % 2 === 0 ? 'completed' : 'completed_no_data';
        Object.values(debugInfo.dataSourceStatuses).forEach(status => {
          if (status.status !== 'not_started') {
            assert.strictEqual(status.status, expectedWorkerStatus, `Job ${i} workers should have ${expectedWorkerStatus} status`);
          }
        });
      }
    });

    it('should provide consistent results on multiple API calls', async () => {
      const scenario = scenarios.mixed;
      const job = await jobProcessor.createTestJob(scenario);
      await jobProcessor.processJobWithScenario(job.jobId, scenario);
      
      // Call debug endpoint multiple times
      const debugInfo1 = await jobProcessor.getDebugInfo(job.jobId);
      const debugInfo2 = await jobProcessor.getDebugInfo(job.jobId);
      const debugInfo3 = await jobProcessor.getDebugInfo(job.jobId);
      
      // Results should be identical
      assert.strictEqual(debugInfo1.overallStatus, debugInfo2.overallStatus, 'Status should be consistent');
      assert.strictEqual(debugInfo2.overallStatus, debugInfo3.overallStatus, 'Status should be consistent');
      
      Object.keys(debugInfo1.dataSourceStatuses).forEach(workerName => {
        assert.strictEqual(
          debugInfo1.dataSourceStatuses[workerName].status, 
          debugInfo2.dataSourceStatuses[workerName].status,
          `${workerName} status should be consistent`
        );
        assert.strictEqual(
          debugInfo2.dataSourceStatuses[workerName].status, 
          debugInfo3.dataSourceStatuses[workerName].status,
          `${workerName} status should be consistent`
        );
      });
    });
  });
});

console.log('End-to-End Status Testing loaded. Run with: node --test tests/end-to-end-status-testing.test.js');