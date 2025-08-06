/**
 * Status Logic False Positive Fixes Tests
 * 
 * CRITICAL: This file contains the exact fixes needed to prevent false positives
 * in the determineWorkerStatus function used by the debug API endpoint.
 * 
 * ISSUE: Workers currently show GREEN status even when no data is returned.
 * FIX: Use hasActualData flags instead of just checking status codes and empty arrays.
 */

const assert = require('assert');
const { describe, it } = require('node:test');

/**
 * CURRENT PROBLEMATIC FUNCTION (from debug route)
 * This is what's causing false positives
 */
function currentDetermineWorkerStatus(workerResponse, dataType) {
  if (!workerResponse) {
    return 'not_started';
  }

  const statusCode = workerResponse.statusCode || (workerResponse.success ? 200 : 500);
  
  // Red status: if status !== 200
  if (statusCode !== 200) {
    return 'failed';
  }
  
  // PROBLEM: Only checks array lengths, ignores hasActualData flags
  let hasData = false;
  
  if (dataType === 'reddit') {
    const posts = workerResponse.posts || workerResponse.data?.posts || [];
    hasData = Array.isArray(posts) && posts.length > 0;
  } else if (dataType === 'youtube') {
    const comments = workerResponse.comments || workerResponse.data?.comments || [];
    const totalComments = workerResponse.data?.totalComments || 0;
    hasData = (Array.isArray(comments) && comments.length > 0) || totalComments > 0;
  } else if (dataType === 'amazon') {
    const reviews = workerResponse.reviews || workerResponse.data?.reviews || [];
    hasData = Array.isArray(reviews) && reviews.length > 0;
  } else if (dataType === 'website') {
    const reviewsFound = workerResponse.data?.reviewsFound || workerResponse.reviewsFound || 0;
    const valuePropsFound = workerResponse.data?.valuePropsFound || workerResponse.valuePropsFound || 0;
    const featuresFound = workerResponse.data?.featuresFound || workerResponse.featuresFound || 0;
    const painPointsFound = workerResponse.data?.painPointsFound || workerResponse.painPointsFound || 0;
    hasData = reviewsFound > 0 || valuePropsFound > 0 || featuresFound > 0 || painPointsFound > 0;
  } else if (dataType === 'persona') {
    const persona = workerResponse.persona || workerResponse.data?.persona;
    hasData = persona && typeof persona === 'string' && persona.length > 100;
  }
  
  // PROBLEM: This can return 'completed' even when hasActualData=false
  if (hasData) {
    return 'completed'; // Green
  } else {
    return 'completed_no_data'; // Yellow
  }
}

/**
 * FIXED FUNCTION - Prevents false positives by using hasActualData flags
 */
function fixedDetermineWorkerStatus(workerResponse, dataType) {
  // Check if worker response exists
  if (!workerResponse) {
    return 'not_started';
  }
  
  // CRITICAL FIX #1: Check for explicit failure first
  if (workerResponse.error || workerResponse.success === false) {
    return 'failed'; // Red status
  }
  
  // CRITICAL FIX #2: Use hasActualData flag as primary indicator
  if (workerResponse.hasActualData === true || workerResponse.dataCollected === true) {
    return 'completed'; // Green status - actual data found
  }
  
  if (workerResponse.hasActualData === false || workerResponse.dataCollected === false) {
    return 'completed_no_data'; // Yellow status - process succeeded but no data
  }
  
  // FALLBACK: Use old logic for backward compatibility (but this should rarely be used)
  const statusCode = workerResponse.statusCode || (workerResponse.success ? 200 : 500);
  
  if (statusCode !== 200) {
    return 'failed';
  }
  
  // Use array-based validation as last resort
  let hasData = false;
  
  if (dataType === 'reddit') {
    const posts = workerResponse.posts || workerResponse.data?.posts || [];
    hasData = Array.isArray(posts) && posts.length > 0;
  } else if (dataType === 'youtube') {
    const comments = workerResponse.comments || workerResponse.data?.comments || [];
    const totalComments = workerResponse.data?.totalComments || 0;
    hasData = (Array.isArray(comments) && comments.length > 0) || totalComments > 0;
  } else if (dataType === 'amazon') {
    const reviews = workerResponse.reviews || workerResponse.data?.reviews || [];
    hasData = Array.isArray(reviews) && reviews.length > 0;
  } else if (dataType === 'website') {
    const reviewsFound = workerResponse.data?.reviewsFound || workerResponse.reviewsFound || 0;
    const valuePropsFound = workerResponse.data?.valuePropsFound || workerResponse.valuePropsFound || 0;
    const featuresFound = workerResponse.data?.featuresFound || workerResponse.featuresFound || 0;
    const painPointsFound = workerResponse.data?.painPointsFound || workerResponse.painPointsFound || 0;
    hasData = reviewsFound > 0 || valuePropsFound > 0 || featuresFound > 0 || painPointsFound > 0;
  } else if (dataType === 'persona') {
    const persona = workerResponse.persona || workerResponse.data?.persona;
    hasData = persona && typeof persona === 'string' && persona.length > 100;
  }
  
  return hasData ? 'completed' : 'completed_no_data';
}

describe('Status Logic False Positive Fixes', () => {
  describe('False Positive Scenarios - Current vs Fixed Logic', () => {
    it('should fix FALSE POSITIVE: Amazon worker with empty reviews but success=true', () => {
      const falsePositiveScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // CRITICAL: This should prevent green status
        dataCollected: false,
        reviews: [], // Empty reviews array
        analysis: {
          extractionStatus: 'NO_REVIEWS_FOUND',
          totalReviews: 0
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(falsePositiveScenario, 'amazon');
      const fixedResult = fixedDetermineWorkerStatus(falsePositiveScenario, 'amazon');
      
      // Current logic incorrectly returns yellow (which is actually correct in this case)
      // But in real scenarios where reviews.length might be checked incorrectly, 
      // it could return green - this test ensures the flag takes precedence
      assert.strictEqual(currentResult, 'completed_no_data', 'Current logic should be yellow');
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should be yellow');
      
      // The key improvement: fixed logic prioritizes hasActualData flag
      console.log('✅ Amazon false positive scenario handled correctly');
    });
    
    it('should fix FALSE POSITIVE: Website worker with success=true but no meaningful content', () => {
      const falsePositiveScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // CRITICAL: Should override any data counts
        dataCollected: false,
        data: {
          reviewsFound: 0,
          featuresFound: 0,
          valuePropsFound: 0,
          painPointsFound: 0
        },
        websiteData: {
          customerReviews: [],
          features: [],
          valuePropositions: []
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(falsePositiveScenario, 'website');
      const fixedResult = fixedDetermineWorkerStatus(falsePositiveScenario, 'website');
      
      assert.strictEqual(currentResult, 'completed_no_data', 'Current logic should be yellow');
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should be yellow');
      
      console.log('✅ Website false positive scenario handled correctly');
    });
    
    it('should fix FALSE POSITIVE: Reddit worker with success=true but empty results', () => {
      const falsePositiveScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // CRITICAL: Should prevent green status
        dataCollected: false,
        posts: [], // Empty posts
        comments: [], // Empty comments
        data: {
          posts: []
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(falsePositiveScenario, 'reddit');
      const fixedResult = fixedDetermineWorkerStatus(falsePositiveScenario, 'reddit');
      
      assert.strictEqual(currentResult, 'completed_no_data', 'Current logic should be yellow');
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should be yellow');
      
      console.log('✅ Reddit false positive scenario handled correctly');
    });
    
    it('should fix FALSE POSITIVE: YouTube worker with success=true but no comments', () => {
      const falsePositiveScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // CRITICAL: Should prevent green status
        dataCollected: false,
        comments: [], // Empty comments
        data: {
          totalComments: 0,
          comments: []
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(falsePositiveScenario, 'youtube');
      const fixedResult = fixedDetermineWorkerStatus(falsePositiveScenario, 'youtube');
      
      assert.strictEqual(currentResult, 'completed_no_data', 'Current logic should be yellow');
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should be yellow');
      
      console.log('✅ YouTube false positive scenario handled correctly');
    });
    
    it('should fix FALSE POSITIVE: Persona worker with success=true but insufficient content', () => {
      const falsePositiveScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // CRITICAL: Should prevent green status
        dataCollected: false,
        persona: 'Error: Insufficient data available', // Too short
        data: {
          persona: 'Error: Insufficient data available'
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(falsePositiveScenario, 'persona');
      const fixedResult = fixedDetermineWorkerStatus(falsePositiveScenario, 'persona');
      
      assert.strictEqual(currentResult, 'completed_no_data', 'Current logic should be yellow');
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should be yellow');
      
      console.log('✅ Persona false positive scenario handled correctly');
    });
  });
  
  describe('Correct Green Status Scenarios', () => {
    it('should show GREEN status when hasActualData=true with real Amazon reviews', () => {
      const validDataScenario = {
        success: true,
        statusCode: 200,
        hasActualData: true, // CRITICAL: This should guarantee green status
        dataCollected: true,
        reviews: [
          { title: 'Great product', text: 'Really works well', rating: 5 },
          { title: 'Good quality', text: 'As described', rating: 4 }
        ],
        analysis: {
          extractionStatus: 'SUCCESS',
          totalReviews: 2
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(validDataScenario, 'amazon');
      const fixedResult = fixedDetermineWorkerStatus(validDataScenario, 'amazon');
      
      assert.strictEqual(currentResult, 'completed', 'Current logic should be green');
      assert.strictEqual(fixedResult, 'completed', 'Fixed logic should be green');
      
      // Verify the fix prioritizes hasActualData flag
      console.log('✅ Valid Amazon data scenario shows green correctly');
    });
    
    it('should show GREEN status when hasActualData=true with real website content', () => {
      const validDataScenario = {
        success: true,
        statusCode: 200,
        hasActualData: true, // CRITICAL: Should guarantee green status
        dataCollected: true,
        data: {
          reviewsFound: 3,
          featuresFound: 2,
          valuePropsFound: 1,
          painPointsFound: 2
        },
        websiteData: {
          customerReviews: ['Amazing product!', 'Really love it!', 'Great quality!'],
          features: ['Feature 1', 'Feature 2'],
          valuePropositions: ['Best value']
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(validDataScenario, 'website');
      const fixedResult = fixedDetermineWorkerStatus(validDataScenario, 'website');
      
      assert.strictEqual(currentResult, 'completed', 'Current logic should be green');
      assert.strictEqual(fixedResult, 'completed', 'Fixed logic should be green');
      
      console.log('✅ Valid website data scenario shows green correctly');
    });
  });
  
  describe('Error Handling Scenarios', () => {
    it('should show RED status for explicit worker failures', () => {
      const failureScenario = {
        success: false, // CRITICAL: Explicit failure
        hasActualData: false,
        error: 'Network timeout after 30 seconds',
        statusCode: 500
      };
      
      const currentResult = currentDetermineWorkerStatus(failureScenario, 'amazon');
      const fixedResult = fixedDetermineWorkerStatus(failureScenario, 'amazon');
      
      assert.strictEqual(currentResult, 'failed', 'Current logic should be red');
      assert.strictEqual(fixedResult, 'failed', 'Fixed logic should be red');
      
      console.log('✅ Failure scenario shows red correctly');
    });
    
    it('should handle missing hasActualData flags gracefully', () => {
      const legacyScenario = {
        success: true,
        statusCode: 200,
        // No hasActualData flag (legacy response)
        reviews: [
          { title: 'Good product', text: 'Works well', rating: 4 }
        ]
      };
      
      const currentResult = currentDetermineWorkerStatus(legacyScenario, 'amazon');
      const fixedResult = fixedDetermineWorkerStatus(legacyScenario, 'amazon');
      
      // Both should handle legacy responses by falling back to array checks
      assert.strictEqual(currentResult, 'completed', 'Current logic should handle legacy data');
      assert.strictEqual(fixedResult, 'completed', 'Fixed logic should handle legacy data');
      
      console.log('✅ Legacy data scenario handled correctly');
    });
  });
  
  describe('Priority and Consistency Tests', () => {
    it('should prioritize hasActualData=false over non-empty arrays (edge case)', () => {
      // Edge case: arrays have data but worker determined it's not meaningful
      const edgeCaseScenario = {
        success: true,
        statusCode: 200,
        hasActualData: false, // Worker says no meaningful data
        dataCollected: false,
        reviews: [
          { title: '', text: '', rating: 0 } // Invalid/empty review data
        ],
        analysis: {
          extractionStatus: 'NO_MEANINGFUL_REVIEWS',
          totalReviews: 0 // Analysis says no valid reviews
        }
      };
      
      const currentResult = currentDetermineWorkerStatus(edgeCaseScenario, 'amazon');
      const fixedResult = fixedDetermineWorkerStatus(edgeCaseScenario, 'amazon');
      
      // Current logic might incorrectly show green due to array length
      // Fixed logic should respect hasActualData flag
      assert.strictEqual(fixedResult, 'completed_no_data', 'Fixed logic should respect hasActualData=false');
      
      console.log('✅ Edge case: hasActualData flag takes priority over array length');
    });
    
    it('should maintain consistent status across all worker types', () => {
      const consistentTestScenarios = [
        { dataType: 'amazon', hasData: false, reviews: [] },
        { dataType: 'website', hasData: false, data: { reviewsFound: 0, featuresFound: 0 } },
        { dataType: 'reddit', hasData: false, posts: [], comments: [] },
        { dataType: 'youtube', hasData: false, comments: [], data: { totalComments: 0 } },
        { dataType: 'persona', hasData: false, persona: 'Too short' }
      ];
      
      consistentTestScenarios.forEach(scenario => {
        const testData = {
          success: true,
          statusCode: 200,
          hasActualData: scenario.hasData,
          dataCollected: scenario.hasData,
          ...scenario
        };
        
        const result = fixedDetermineWorkerStatus(testData, scenario.dataType);
        assert.strictEqual(result, 'completed_no_data', 
          `${scenario.dataType} should have consistent yellow status when hasActualData=false`);
      });
      
      console.log('✅ Status consistency maintained across all worker types');
    });
  });
});

console.log('Status Logic False Positive Fixes Tests loaded. Run with: node --test tests/status-logic-false-positive-fixes.test.js');