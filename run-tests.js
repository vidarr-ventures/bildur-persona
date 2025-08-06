#!/usr/bin/env node

/**
 * Test Runner for Worker Status Logic Tests
 * 
 * This script runs all the status logic tests and provides a comprehensive
 * report on the worker system's behavior.
 */

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔬 Worker Status Logic Test Suite');
console.log('=====================================');
console.log('');

// Test files to run
const testFiles = [
  'tests/worker-status-logic.test.js',
  'tests/api-status-endpoints.test.js', 
  'tests/end-to-end-status-testing.test.js'
];

// Check if test files exist
console.log('📋 Checking test files...');
const missingFiles = testFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.error('❌ Missing test files:');
  missingFiles.forEach(file => console.error(`   - ${file}`));
  process.exit(1);
}
console.log('✅ All test files found');
console.log('');

// Function to run a test file and capture output
async function runTestFile(testFile) {
  return new Promise((resolve, reject) => {
    console.log(`🧪 Running ${testFile}...`);
    console.log('-'.repeat(50));
    
    const child = spawn('node', ['--test', testFile], {
      stdio: 'pipe',
      cwd: process.cwd()
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output); // Real-time output
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output); // Real-time output
    });

    child.on('close', (code) => {
      console.log('');
      console.log(`📊 ${testFile} completed with exit code: ${code}`);
      console.log('');
      
      resolve({
        file: testFile,
        exitCode: code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      console.error(`❌ Error running ${testFile}:`, error.message);
      reject(error);
    });
  });
}

// Run all tests
async function runAllTests() {
  const results = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log('🚀 Starting test execution...');
  console.log('');

  for (const testFile of testFiles) {
    try {
      const result = await runTestFile(testFile);
      results.push(result);
      
      if (result.success) {
        console.log(`✅ ${testFile}: PASSED`);
      } else {
        console.log(`❌ ${testFile}: FAILED`);
        failedTests++;
      }
    } catch (error) {
      console.error(`💥 ${testFile}: ERROR - ${error.message}`);
      results.push({
        file: testFile,
        exitCode: -1,
        success: false,
        error: error.message
      });
      failedTests++;
    }
  }

  console.log('');
  console.log('📈 Test Summary');
  console.log('================');
  console.log(`Total test files: ${testFiles.length}`);
  console.log(`Passed: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);
  console.log('');

  // Detailed results
  console.log('📋 Detailed Results');
  console.log('===================');
  results.forEach(result => {
    console.log(`${result.success ? '✅' : '❌'} ${result.file}`);
    if (!result.success) {
      console.log(`   Exit Code: ${result.exitCode}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
    }
  });
  console.log('');

  // Test coverage summary
  console.log('🎯 Test Coverage Summary');
  console.log('=========================');
  console.log('✅ Worker Status Logic:');
  console.log('   - Website Crawler: Green, Yellow, Red scenarios');
  console.log('   - Amazon Reviews: Success, No Data, Failure scenarios');
  console.log('   - Reddit Scraper: Posts/Comments detection');
  console.log('   - YouTube Comments: Video/Comment analysis');
  console.log('   - Persona Generator: Content length evaluation');
  console.log('');
  console.log('✅ API Status Determination:');
  console.log('   - Worker results analysis');
  console.log('   - Database data analysis');  
  console.log('   - Status priority and fallback logic');
  console.log('   - Content volume calculations');
  console.log('   - Error message preservation');
  console.log('');
  console.log('✅ End-to-End Integration:');
  console.log('   - Complete job processing flow');
  console.log('   - All-green, all-yellow, all-red scenarios');
  console.log('   - Mixed results handling');
  console.log('   - Status consistency across pipeline');
  console.log('   - Performance with multiple jobs');
  console.log('');

  // Exit with appropriate code
  const allPassed = results.every(r => r.success);
  if (allPassed) {
    console.log('🎉 All tests passed! Worker status logic is functioning correctly.');
    console.log('');
    console.log('✨ Status Logic Validation Complete');
    console.log('===================================');
    console.log('🟢 Green Status: Workers return actual data');
    console.log('🟡 Yellow Status: Workers complete but find no data'); 
    console.log('🔴 Red Status: Workers fail with errors');
    console.log('');
    console.log('The persona app worker system is ready for deployment!');
    process.exit(0);
  } else {
    console.log('💥 Some tests failed. Please review the results above.');
    console.log('');
    console.log('🔧 Next Steps:');
    console.log('1. Review failed test output');
    console.log('2. Fix any identified issues in worker logic');
    console.log('3. Re-run tests to verify fixes');
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Test execution interrupted');
  process.exit(1);
});

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
if (majorVersion < 18) {
  console.warn(`⚠️  Warning: Node.js ${nodeVersion} detected. Tests use Node.js built-in test runner which requires Node.js 18+`);
  console.log('Consider upgrading to Node.js 18 or later for best results.');
  console.log('');
}

// Run the tests
runAllTests().catch(error => {
  console.error('💥 Fatal error running test suite:', error);
  process.exit(1);
});