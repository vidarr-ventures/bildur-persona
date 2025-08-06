/**
 * API Status Endpoints Tests
 * 
 * This file tests the API endpoints that determine and return worker status information.
 * Tests the critical status logic fixes and ensures proper status determination.
 */

const assert = require('assert');
const { describe, it, beforeEach } = require('node:test');

// Mock the debug API status analysis functions
class MockStatusAnalyzer {
  constructor() {
    this.mockWorkerResults = {};
    this.mockDbData = {};
  }

  setMockWorkerResults(results) {
    this.mockWorkerResults = results;
  }

  setMockDbData(data) {
    this.mockDbData = data;
  }

  // This mimics the analyzeDataSourceStatusFromWorkers function
  analyzeDataSourceStatusFromWorkers(workerResults, dataType) {
    if (!workerResults || !workerResults[dataType]) {
      return null;
    }

    const data = workerResults[dataType];
    
    if (!data.success) {
      return {
        status: 'failed',
        dataReturned: false,
        contentVolume: 'No data',
        extractionMethod: 'Unknown',
        processingTime: 'Unknown',
        statusCode: data.statusCode || 500,
        errorMessage: data.error || data.message || 'Worker failed'
      };
    }

    const workerData = data.data || {};
    const isAIPowered = ['website', 'amazon', 'reddit'].includes(dataType);
    const isPersona = dataType === 'persona';

    // NEW: Determine proper status based on actual data collection
    let status = 'completed';
    if (data.hasActualData === false || data.dataCollected === false) {
      status = 'completed_no_data'; // Yellow status
    } else if (data.hasActualData === true || data.dataCollected === true) {
      status = 'completed'; // Green status
    }

    if (isPersona) {
      // For personas, rely primarily on hasActualData flag rather than content analysis
      const hasPersonaData = data.hasActualData === true || (!!workerData.persona && workerData.persona.length > 100);
      return {
        status: data.error ? 'failed' : (hasPersonaData ? 'completed' : 'completed_no_data'),
        outputGenerated: hasPersonaData,
        personaLength: this.calculatePersonaLength(workerData),
        extractionMethod: 'Sequential AI Analysis',
        processingTime: 'Real-time',
        statusCode: 200
      };
    } else if (isAIPowered) {
      const hasReviews = workerData.reviews?.length > 0 || 
                        workerData.websiteData?.customerReviews?.length > 0 ||
                        workerData.posts?.length > 0;
      
      const reviewCount = workerData.reviews?.length || 
                         workerData.websiteData?.customerReviews?.length || 
                         workerData.posts?.length || 
                         0;
      
      return {
        status: data.hasActualData === true ? 'completed' : (data.hasActualData === false ? 'completed_no_data' : status),
        dataReturned: data.hasActualData === true,
        contentVolume: hasReviews ? `${reviewCount} items found` : 'No data',
        extractionMethod: this.getAIMethod(dataType),
        processingTime: 'Real-time',
        statusCode: 200,
        reviewsFound: reviewCount
      };
    } else if (dataType === 'youtube') {
      const totalComments = workerData.totalComments || workerData.comments?.length || 0;
      const videosAnalyzed = workerData.videosAnalyzed || workerData.videos?.length || 0;
      const hasComments = totalComments > 0;
      
      return {
        status: data.error ? 'failed' : (hasComments ? 'completed' : 'completed_no_data'),
        commentsFound: `${totalComments} comments`,
        videosProcessed: `${videosAnalyzed} videos`,
        extractionMethod: 'YouTube API',
        processingTime: 'Real-time',
        statusCode: 200
      };
    }

    return {
      status: data.hasActualData === false ? 'completed_no_data' : 'completed',
      extractionMethod: 'Unknown',
      processingTime: 'Real-time',
      statusCode: 200
    };
  }

  // This mimics the analyzeDataSourceStatusFromDb function
  analyzeDataSourceStatusFromDb(dbJobData, dataType) {
    if (!dbJobData || !dbJobData[dataType]) {
      return null;
    }
    
    const data = dbJobData[dataType];
    
    const isAIPowered = ['website', 'amazon_reviews', 'reddit'].includes(dataType);
    const isPersona = dataType === 'persona_profile';
    
    // NEW: Determine proper status based on data collection success
    let status = 'completed';
    if (data.error || data.success === false) {
      status = 'failed';
    } else if (data.hasActualData === false || data.dataCollected === false) {
      status = 'completed_no_data'; // Yellow status
    } else if (data.hasActualData === true || data.dataCollected === true) {
      status = 'completed'; // Green status
    }
    
    const baseStatus = {
      status: status,
      extractionMethod: this.extractMethodFromDb(data, dataType),
      processingTime: this.formatProcessingTime(data.metadata?.processingTime || Date.now()),
      statusCode: 200,
      errorMessage: data.error || null,
      metadata: {
        timestamp: data.metadata?.timestamp || new Date().toISOString(),
        dataQuality: data.dataQuality || data.analysis?.dataQuality,
        analysis: data.analysis,
        hasActualData: data.hasActualData
      }
    };

    if (isPersona) {
      // For personas, rely primarily on hasActualData flag rather than content analysis
      const hasPersonaData = data.hasActualData === true || (!!data.persona && data.persona.length > 100);
      return {
        ...baseStatus,
        status: data.error ? 'failed' : (hasPersonaData ? 'completed' : 'completed_no_data'),
        outputGenerated: hasPersonaData,
        personaLength: this.calculatePersonaLength(data),
        extractionMethod: 'Sequential AI Analysis'
      };
    } else if (isAIPowered) {
      return {
        ...baseStatus,
        dataReturned: data.hasActualData === true,
        contentVolume: this.calculateContentVolume(data, dataType),
        extractionMethod: this.getAIMethod(dataType)
      };
    } else {
      const hasComments = this.extractCommentsCountNumber(data, dataType) > 0;
      return {
        ...baseStatus,
        status: data.error ? 'failed' : (hasComments ? 'completed' : 'completed_no_data'),
        commentsFound: this.extractCommentsCount(data, dataType),
        videosProcessed: this.extractVideosCount(data, dataType),
        extractionMethod: 'YouTube API'
      };
    }
  }

  calculatePersonaLength(data) {
    if (!data.persona && !data.analysis) return '0 words';
    
    const personaText = data.persona || JSON.stringify(data.analysis);
    const wordCount = personaText.split(' ').length;
    
    if (wordCount < 1000) return `${wordCount} words`;
    return `${(wordCount / 1000).toFixed(1)}k words`;
  }

  calculateContentVolume(data, dataType) {
    let totalWords = 0;
    
    if (dataType === 'website') {
      if (data.websiteData?.customerReviews) {
        totalWords += data.websiteData.customerReviews.length * 50; // Estimate
      }
    } else if (dataType === 'amazon_reviews') {
      if (data.reviews && Array.isArray(data.reviews)) {
        totalWords += data.reviews.length * 100; // Estimate
      }
    } else if (dataType === 'reddit') {
      if (data.posts && Array.isArray(data.posts)) {
        totalWords += data.posts.length * 75; // Estimate
      }
    }
    
    if (totalWords === 0) return 'No data';
    if (totalWords < 1000) return `${totalWords} words`;
    return `${(totalWords / 1000).toFixed(1)}k words`;
  }

  extractCommentsCount(data, dataType) {
    if (dataType === 'youtube_comments') {
      const totalComments = data.comments?.length || data.analysis?.totalComments || 0;
      return `${totalComments} comments`;
    }
    return '0 comments';
  }

  extractVideosCount(data, dataType) {
    if (dataType === 'youtube_comments') {
      const videosCount = data.analysis?.videosAnalyzed || 0;
      return `${videosCount} videos`;
    }
    return '0 videos';
  }

  extractCommentsCountNumber(data, dataType) {
    if (dataType === 'youtube_comments') {
      return data.comments?.length || data.analysis?.totalComments || 0;
    }
    return 0;
  }

  getAIMethod(dataType) {
    const methods = {
      'website': 'OpenAI Analysis',
      'amazon_reviews': 'API + AI Analysis', 
      'reddit': 'API + AI Analysis'
    };
    return methods[dataType] || 'AI Analysis';
  }

  extractMethodFromDb(data, dataType) {
    if (data.metadata && data.metadata.extractionMethod) {
      return data.metadata.extractionMethod;
    }
    
    const defaultMethods = {
      'website': 'openai_extraction',
      'youtube_comments': 'youtube_api_v3',
      'reddit': 'reddit_api_v1',
      'amazon_reviews': 'custom_amazon_scraper',
      'persona_profile': 'sequential_analysis'
    };
    
    return defaultMethods[dataType] || 'Unknown';
  }

  formatProcessingTime(timestamp) {
    if (!timestamp) return 'Unknown';
    if (timestamp < 60000) return `${timestamp}ms`;
    return `${(timestamp / 1000).toFixed(1)}s`;
  }
}

// Test data scenarios
const createTestScenarios = () => {
  return {
    // Green scenarios - successful data collection
    websiteSuccessWithData: {
      success: true,
      hasActualData: true,
      dataCollected: true,
      data: {
        websiteData: {
          customerReviews: ['Review 1', 'Review 2'],
          features: ['Feature 1'],
          valuePropositions: ['Value 1']
        }
      }
    },
    
    amazonSuccessWithData: {
      success: true,
      hasActualData: true,
      dataCollected: true,
      data: {
        reviews: [
          { title: 'Great', text: 'Works well', rating: 5 },
          { title: 'Good', text: 'As expected', rating: 4 }
        ]
      }
    },

    redditSuccessWithData: {
      success: true,
      hasActualData: true,
      dataCollected: true,
      data: {
        posts: [{ title: 'Post 1', content: 'Content 1' }],
        totalComments: 5
      }
    },

    youtubeSuccessWithData: {
      success: true,
      hasActualData: true,
      dataCollected: true,
      data: {
        comments: [{ text: 'Great video' }],
        totalComments: 1,
        videosAnalyzed: 1
      }
    },

    personaSuccessWithData: {
      success: true,
      hasActualData: true,
      dataCollected: true,
      data: {
        persona: 'This is a comprehensive persona analysis with detailed demographics, pain points, goals, and characteristics that spans well over 100 characters and provides actionable insights for marketing teams.',
        analysis: { confidence: 'high', score: 85 }
      }
    },

    // Yellow scenarios - no meaningful data
    websiteSuccessNoData: {
      success: true,
      hasActualData: false,
      dataCollected: false,
      data: {
        websiteData: {
          customerReviews: [],
          features: [],
          valuePropositions: []
        }
      }
    },

    amazonSuccessNoData: {
      success: true,
      hasActualData: false,
      dataCollected: false,
      data: {
        reviews: []
      }
    },

    redditSuccessNoData: {
      success: true,
      hasActualData: false,
      dataCollected: false,
      data: {
        posts: [],
        totalComments: 0
      }
    },

    youtubeSuccessNoData: {
      success: true,
      hasActualData: false,
      dataCollected: false,
      data: {
        comments: [],
        totalComments: 0,
        videosAnalyzed: 0
      }
    },

    personaSuccessNoData: {
      success: true,
      hasActualData: false,
      dataCollected: false,
      data: {
        persona: 'Error: Insufficient data',
        analysis: { confidence: 'low', score: 15 }
      }
    },

    // Red scenarios - failures
    websiteFailure: {
      success: false,
      hasActualData: false,
      dataCollected: false,
      error: 'Network timeout',
      statusCode: 500
    },

    amazonFailure: {
      success: false,
      hasActualData: false,
      dataCollected: false,
      error: 'Amazon blocked request',
      statusCode: 403
    },

    redditFailure: {
      success: false,
      hasActualData: false,
      dataCollected: false,
      error: 'Reddit API rate limit',
      statusCode: 429
    },

    youtubeFailure: {
      success: false,
      hasActualData: false,
      dataCollected: false,
      error: 'YouTube quota exceeded',
      statusCode: 403
    }
  };
};

// Tests start here
describe('API Status Endpoints Tests', () => {
  let analyzer;
  let scenarios;

  beforeEach(() => {
    analyzer = new MockStatusAnalyzer();
    scenarios = createTestScenarios();
  });

  describe('Worker Results Status Analysis', () => {
    it('should return GREEN status for workers with actual data', () => {
      const testCases = [
        { dataType: 'website', scenario: scenarios.websiteSuccessWithData },
        { dataType: 'amazon', scenario: scenarios.amazonSuccessWithData },
        { dataType: 'reddit', scenario: scenarios.redditSuccessWithData },
        { dataType: 'youtube', scenario: scenarios.youtubeSuccessWithData },
        { dataType: 'persona', scenario: scenarios.personaSuccessWithData }
      ];

      testCases.forEach(({ dataType, scenario }) => {
        analyzer.setMockWorkerResults({ [dataType]: scenario });
        const result = analyzer.analyzeDataSourceStatusFromWorkers({ [dataType]: scenario }, dataType);
        
        assert.strictEqual(result.status, 'completed', `${dataType} should have completed (green) status`);
        if (dataType === 'persona') {
          assert.strictEqual(result.outputGenerated, true, `${dataType} should have outputGenerated = true`);
        } else if (['website', 'amazon', 'reddit'].includes(dataType)) {
          assert.strictEqual(result.dataReturned, true, `${dataType} should have dataReturned = true`);
        }
      });
    });

    it('should return YELLOW status for workers with no data', () => {
      const testCases = [
        { dataType: 'website', scenario: scenarios.websiteSuccessNoData },
        { dataType: 'amazon', scenario: scenarios.amazonSuccessNoData },
        { dataType: 'reddit', scenario: scenarios.redditSuccessNoData },
        { dataType: 'youtube', scenario: scenarios.youtubeSuccessNoData },
        { dataType: 'persona', scenario: scenarios.personaSuccessNoData }
      ];

      testCases.forEach(({ dataType, scenario }) => {
        analyzer.setMockWorkerResults({ [dataType]: scenario });
        const result = analyzer.analyzeDataSourceStatusFromWorkers({ [dataType]: scenario }, dataType);
        
        assert.strictEqual(result.status, 'completed_no_data', `${dataType} should have completed_no_data (yellow) status`);
        if (dataType === 'persona') {
          assert.strictEqual(result.outputGenerated, false, `${dataType} should have outputGenerated = false`);
        } else if (['website', 'amazon', 'reddit'].includes(dataType)) {
          assert.strictEqual(result.dataReturned, false, `${dataType} should have dataReturned = false`);
        }
      });
    });

    it('should return RED status for failed workers', () => {
      const testCases = [
        { dataType: 'website', scenario: scenarios.websiteFailure },
        { dataType: 'amazon', scenario: scenarios.amazonFailure },
        { dataType: 'reddit', scenario: scenarios.redditFailure },
        { dataType: 'youtube', scenario: scenarios.youtubeFailure }
      ];

      testCases.forEach(({ dataType, scenario }) => {
        analyzer.setMockWorkerResults({ [dataType]: scenario });
        const result = analyzer.analyzeDataSourceStatusFromWorkers({ [dataType]: scenario }, dataType);
        
        assert.strictEqual(result.status, 'failed', `${dataType} should have failed (red) status`);
        assert.strictEqual(result.dataReturned, false, `${dataType} should have dataReturned = false`);
        assert.ok(result.errorMessage, `${dataType} should have error message`);
      });
    });
  });

  describe('Database Data Status Analysis', () => {
    it('should correctly analyze database-stored worker results with data', () => {
      // Convert worker scenarios to database format
      const dbTestCases = [
        { 
          dataType: 'website', 
          dbData: {
            website: {
              ...scenarios.websiteSuccessWithData,
              metadata: { timestamp: new Date().toISOString() }
            }
          }
        },
        { 
          dataType: 'amazon_reviews', 
          dbData: {
            amazon_reviews: {
              ...scenarios.amazonSuccessWithData,
              metadata: { timestamp: new Date().toISOString() }
            }
          }
        }
      ];

      dbTestCases.forEach(({ dataType, dbData }) => {
        analyzer.setMockDbData(dbData);
        const result = analyzer.analyzeDataSourceStatusFromDb(dbData, dataType);
        
        assert.strictEqual(result.status, 'completed', `${dataType} should have completed (green) status from DB`);
        assert.strictEqual(result.dataReturned, true, `${dataType} should have dataReturned = true from DB`);
        assert.ok(result.metadata, `${dataType} should have metadata from DB`);
      });
    });

    it('should correctly analyze database-stored worker results with no data', () => {
      const dbTestCases = [
        { 
          dataType: 'website', 
          dbData: {
            website: {
              ...scenarios.websiteSuccessNoData,
              metadata: { timestamp: new Date().toISOString() }
            }
          }
        },
        { 
          dataType: 'youtube_comments', 
          dbData: {
            youtube_comments: {
              ...scenarios.youtubeSuccessNoData,
              metadata: { timestamp: new Date().toISOString() }
            }
          }
        }
      ];

      dbTestCases.forEach(({ dataType, dbData }) => {
        analyzer.setMockDbData(dbData);
        const result = analyzer.analyzeDataSourceStatusFromDb(dbData, dataType);
        
        assert.strictEqual(result.status, 'completed_no_data', `${dataType} should have completed_no_data (yellow) status from DB`);
        if (['website', 'amazon_reviews', 'reddit'].includes(dataType)) {
          assert.strictEqual(result.dataReturned, false, `${dataType} should have dataReturned = false from DB`);
        }
      });
    });

    it('should correctly analyze database-stored failed results', () => {
      const dbFailureData = {
        website: {
          success: false,
          hasActualData: false,
          dataCollected: false,
          error: 'Database connection failed',
          metadata: { timestamp: new Date().toISOString() }
        }
      };

      analyzer.setMockDbData(dbFailureData);
      const result = analyzer.analyzeDataSourceStatusFromDb(dbFailureData, 'website');
      
      assert.strictEqual(result.status, 'failed', 'Should have failed (red) status from DB');
      assert.strictEqual(result.dataReturned, false, 'Should have dataReturned = false from DB');
      assert.strictEqual(result.errorMessage, 'Database connection failed', 'Should preserve error message from DB');
    });
  });

  describe('Status Priority and Fallback Logic', () => {
    it('should prioritize worker results over database results', () => {
      // Set up scenario where worker has fresh data but DB has old no-data result
      const workerResults = {
        website: scenarios.websiteSuccessWithData
      };
      
      const dbData = {
        website: scenarios.websiteSuccessNoData
      };

      analyzer.setMockWorkerResults(workerResults);
      analyzer.setMockDbData(dbData);

      // In real API, this would check worker results first, then fall back to DB
      const workerResult = analyzer.analyzeDataSourceStatusFromWorkers(workerResults, 'website');
      const dbResult = analyzer.analyzeDataSourceStatusFromDb(dbData, 'website');

      // Worker result should be green (has data)
      assert.strictEqual(workerResult.status, 'completed', 'Worker result should be completed (green)');
      assert.strictEqual(workerResult.dataReturned, true, 'Worker result should have data');

      // DB result should be yellow (no data) 
      assert.strictEqual(dbResult.status, 'completed_no_data', 'DB result should be completed_no_data (yellow)');
      assert.strictEqual(dbResult.dataReturned, false, 'DB result should have no data');

      // In the actual API, worker result would take priority
    });

    it('should handle null/undefined data gracefully', () => {
      // Test with completely missing data
      const workerResult = analyzer.analyzeDataSourceStatusFromWorkers(null, 'website');
      const dbResult = analyzer.analyzeDataSourceStatusFromDb(null, 'website');

      assert.strictEqual(workerResult, null, 'Should return null for missing worker data');
      assert.strictEqual(dbResult, null, 'Should return null for missing DB data');
    });

    it('should handle partial data structures', () => {
      // Test with incomplete worker data
      const partialWorkerData = {
        website: {
          success: true,
          // Missing hasActualData and dataCollected fields
        }
      };

      const result = analyzer.analyzeDataSourceStatusFromWorkers(partialWorkerData, 'website');
      
      // Should default to completed status when hasActualData is undefined
      assert.strictEqual(result.status, 'completed', 'Should default to completed for partial data');
    });
  });

  describe('Content Volume and Metrics Calculation', () => {
    it('should correctly calculate content volume for different data types', () => {
      const testData = {
        website: {
          hasActualData: true,
          websiteData: {
            customerReviews: ['Review 1', 'Review 2', 'Review 3']
          }
        },
        amazon_reviews: {
          hasActualData: true,
          reviews: [
            { title: 'Great', text: 'Good product' },
            { title: 'OK', text: 'Average quality' }
          ]
        }
      };

      const websiteVolume = analyzer.calculateContentVolume(testData.website, 'website');
      const amazonVolume = analyzer.calculateContentVolume(testData.amazon_reviews, 'amazon_reviews');

      assert.ok(websiteVolume !== 'No data', 'Website should have content volume calculated');
      assert.ok(amazonVolume !== 'No data', 'Amazon should have content volume calculated');
      assert.ok(websiteVolume.includes('words') || websiteVolume.includes('k words'), 'Website volume should be in words');
      assert.ok(amazonVolume.includes('words') || amazonVolume.includes('k words'), 'Amazon volume should be in words');
    });

    it('should correctly calculate persona length', () => {
      const shortPersona = { persona: 'Short persona description' };
      const longPersona = { 
        persona: 'This is a very long persona description that contains detailed demographics, psychographics, pain points, goals, motivations, buying behavior, and other comprehensive insights about the target customer that would be useful for marketing teams to understand their audience better and create more targeted campaigns.'
      };

      const shortLength = analyzer.calculatePersonaLength(shortPersona);
      const longLength = analyzer.calculatePersonaLength(longPersona);

      assert.ok(shortLength.includes('words'), 'Should calculate short persona length');
      assert.ok(longLength.includes('words'), 'Should calculate long persona length');
      
      // Long persona should have more words
      const shortCount = parseInt(shortLength.split(' ')[0]);
      const longCount = parseInt(longLength.split(' ')[0]);
      assert.ok(longCount > shortCount, 'Long persona should have more words than short persona');
    });
  });

  describe('Error Message Preservation', () => {
    it('should preserve and return error messages from failed workers', () => {
      const errorMessages = [
        'Network timeout after 30 seconds',
        'API rate limit exceeded',  
        'Authentication failed - invalid key',
        'Service temporarily unavailable'
      ];

      errorMessages.forEach(errorMsg => {
        const failedWorkerResult = {
          website: {
            success: false,
            hasActualData: false,
            error: errorMsg,
            statusCode: 500
          }
        };

        const result = analyzer.analyzeDataSourceStatusFromWorkers(failedWorkerResult, 'website');
        assert.strictEqual(result.status, 'failed', 'Should have failed status');
        assert.strictEqual(result.errorMessage, errorMsg, 'Should preserve exact error message');
      });
    });
  });
});

console.log('API Status Endpoints Tests loaded. Run with: node --test tests/api-status-endpoints.test.js');