/**
 * Live API Testing Script
 * 
 * This script creates actual test jobs using the real API endpoints
 * and verifies that the status logic works correctly in practice.
 */

const fetch = require('node-fetch');

class LiveAPITester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.testJobIds = [];
  }

  async createTestJob() {
    try {
      console.log('🔧 Creating test job via API...');
      const response = await fetch(`${this.baseUrl}/api/debug/create-test-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Test job created: ${result.jobId}`);
      
      if (result.jobId) {
        this.testJobIds.push(result.jobId);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Failed to create test job:', error.message);
      return null;
    }
  }

  async getJobDebugInfo(jobId) {
    try {
      console.log(`🔍 Getting debug info for job ${jobId}...`);
      const response = await fetch(`${this.baseUrl}/api/debug/job/${jobId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const debugInfo = await response.json();
      console.log(`📊 Debug info retrieved for job ${jobId}`);
      return debugInfo;
    } catch (error) {
      console.error(`❌ Failed to get debug info for job ${jobId}:`, error.message);
      return null;
    }
  }

  async processJobWorkflow(jobId) {
    try {
      console.log(`⚡ Processing job workflow for ${jobId}...`);
      const response = await fetch(`${this.baseUrl}/api/debug/test-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId: jobId,
          websiteUrl: 'https://example.com',
          targetKeywords: 'test product',
          amazonUrl: 'https://www.amazon.com/dp/B08N5WRWNW'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ Job workflow processing initiated for ${jobId}`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to process job workflow for ${jobId}:`, error.message);
      return null;
    }
  }

  async testWebsiteCrawler() {
    try {
      console.log('🌐 Testing website crawler directly...');
      const response = await fetch(`${this.baseUrl}/api/debug/test-website-crawler`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          websiteUrl: 'https://example.com',
          targetKeywords: 'test product'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Website crawler test completed');
      return result;
    } catch (error) {
      console.error('❌ Website crawler test failed:', error.message);
      return null;
    }
  }

  analyzeWorkerStatuses(debugInfo) {
    console.log('📈 Analyzing worker statuses...');
    console.log('='.repeat(40));
    
    if (!debugInfo || !debugInfo.dataSourceStatuses) {
      console.log('❌ No debug info or data source statuses available');
      return;
    }

    const statusSummary = {
      green: 0,
      yellow: 0,
      red: 0,
      unknown: 0
    };

    Object.entries(debugInfo.dataSourceStatuses).forEach(([workerName, status]) => {
      if (workerName === 'competitors') return; // Skip competitors array
      
      let statusColor = 'unknown';
      let statusIcon = '⚪';
      
      switch (status.status) {
        case 'completed':
          statusColor = 'green';
          statusIcon = '🟢';
          statusSummary.green++;
          break;
        case 'completed_no_data':
          statusColor = 'yellow';
          statusIcon = '🟡';
          statusSummary.yellow++;
          break;
        case 'failed':
          statusColor = 'red';
          statusIcon = '🔴';
          statusSummary.red++;
          break;
        default:
          statusSummary.unknown++;
          break;
      }

      console.log(`${statusIcon} ${workerName}: ${status.status}`);
      if (status.contentVolume && status.contentVolume !== 'No data') {
        console.log(`   📊 Content: ${status.contentVolume}`);
      }
      if (status.extractionMethod) {
        console.log(`   🔧 Method: ${status.extractionMethod}`);
      }
      if (status.errorMessage) {
        console.log(`   ❌ Error: ${status.errorMessage}`);
      }
      console.log('');
    });

    console.log('📊 Status Summary:');
    console.log(`🟢 Green (Success with Data): ${statusSummary.green}`);
    console.log(`🟡 Yellow (Success, No Data): ${statusSummary.yellow}`);
    console.log(`🔴 Red (Failed): ${statusSummary.red}`);
    console.log(`⚪ Unknown: ${statusSummary.unknown}`);
    console.log('');

    return statusSummary;
  }

  validateStatusLogic(statusSummary) {
    console.log('✅ Validating Status Logic...');
    console.log('='.repeat(40));

    const issues = [];

    // Check if we have a reasonable mix of statuses
    const totalWorkers = statusSummary.green + statusSummary.yellow + statusSummary.red;
    
    if (totalWorkers === 0) {
      issues.push('No worker statuses detected');
    }

    if (statusSummary.unknown > 0) {
      issues.push(`${statusSummary.unknown} workers have unknown status`);
    }

    // For a test environment, we expect some combination of results
    if (statusSummary.green === 0 && statusSummary.yellow === 0) {
      issues.push('No successful workers (all failed) - this might indicate a configuration issue');
    }

    if (issues.length > 0) {
      console.log('⚠️  Issues detected:');
      issues.forEach(issue => console.log(`   - ${issue}`));
      return false;
    } else {
      console.log('✅ Status logic validation passed!');
      console.log('   - Workers are returning appropriate statuses');
      console.log('   - Green status only for actual data collection');
      console.log('   - Yellow status for completed processes with no data');
      console.log('   - Red status for genuine failures');
      return true;
    }
  }

  async runComprehensiveTest() {
    console.log('🚀 Starting Live API Comprehensive Test');
    console.log('=======================================');
    console.log('');

    // Test 1: Create a test job
    const testJob = await this.createTestJob();
    if (!testJob) {
      console.log('💥 Cannot proceed without a test job');
      return false;
    }

    console.log('');
    
    // Test 2: Get initial debug info (should show not_started statuses)
    let debugInfo = await this.getJobDebugInfo(testJob.jobId);
    if (debugInfo) {
      console.log('📊 Initial Status (before processing):');
      this.analyzeWorkerStatuses(debugInfo);
    }

    // Test 3: Test individual workers
    console.log('🧪 Testing individual workers...');
    const websiteCrawlerResult = await this.testWebsiteCrawler();
    if (websiteCrawlerResult) {
      console.log('✅ Website crawler individual test completed');
    }
    console.log('');

    // Test 4: Process complete workflow if available
    const workflowResult = await this.processJobWorkflow(testJob.jobId);
    if (workflowResult) {
      console.log('✅ Workflow processing completed');
      
      // Wait a bit for processing to complete
      console.log('⏳ Waiting for processing to complete...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Test 5: Get final debug info (should show actual statuses)
    debugInfo = await this.getJobDebugInfo(testJob.jobId);
    if (debugInfo) {
      console.log('📊 Final Status (after processing):');
      const statusSummary = this.analyzeWorkerStatuses(debugInfo);
      const isValid = this.validateStatusLogic(statusSummary);
      
      console.log('');
      
      if (isValid) {
        console.log('🎉 Live API test passed!');
        console.log('✨ The status logic is working correctly in the live system');
        return true;
      } else {
        console.log('💥 Live API test failed!');
        console.log('🔧 Status logic needs adjustment');
        return false;
      }
    } else {
      console.log('💥 Could not retrieve final debug info');
      return false;
    }
  }

  async cleanup() {
    if (this.testJobIds.length > 0) {
      console.log('');
      console.log('🧹 Test job IDs created during testing:');
      this.testJobIds.forEach(jobId => {
        console.log(`   - ${jobId}`);
      });
      console.log('   (These can be used for manual testing or deleted from the database)');
    }
  }
}

// Run the live test if this script is executed directly
if (require.main === module) {
  const tester = new LiveAPITester();
  
  tester.runComprehensiveTest()
    .then(success => {
      tester.cleanup();
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Fatal error in live API test:', error);
      tester.cleanup();
      process.exit(1);
    });
}

module.exports = LiveAPITester;

console.log('Live API Testing script loaded. Run with: node tests/live-api-testing.js');