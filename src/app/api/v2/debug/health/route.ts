// Debug health check endpoint to test KV storage and debug functionality

import { NextResponse } from 'next/server';
import { DebugStorage } from '../../../../../lib/debug-storage';

export async function GET() {
  const testId = `test_${Date.now()}`;
  const debugStorage = DebugStorage.getInstance();
  
  const healthCheck = {
    timestamp: new Date().toISOString(),
    environment: {
      hasKvUrl: !!process.env.KV_REST_API_URL,
      hasKvToken: !!process.env.KV_REST_API_TOKEN,
      kvUrl: process.env.KV_REST_API_URL ? `${process.env.KV_REST_API_URL.substring(0, 20)}...` : 'Not set',
    },
    tests: {
      kvConnection: false,
      storageInit: false,
      storageRetrieve: false,
      storageUpdate: false
    },
    errors: [] as string[]
  };
  
  try {
    // Test 1: Initialize steps
    console.log('[HealthCheck] Testing step initialization...');
    await debugStorage.initializeSteps(testId, ['TEST_STEP_1', 'TEST_STEP_2']);
    healthCheck.tests.storageInit = true;
    
    // Test 2: Retrieve steps
    console.log('[HealthCheck] Testing step retrieval...');
    const steps = await debugStorage.getSteps(testId);
    healthCheck.tests.storageRetrieve = steps.length === 2;
    
    if (!healthCheck.tests.storageRetrieve) {
      healthCheck.errors.push(`Expected 2 steps, got ${steps.length}`);
    }
    
    // Test 3: Update step
    console.log('[HealthCheck] Testing step update...');
    await debugStorage.updateStep(testId, 'TEST_STEP_1', {
      status: 'completed',
      completedAt: new Date(),
      output: { test: true }
    });
    
    const updatedSteps = await debugStorage.getSteps(testId);
    const updatedStep = updatedSteps.find(s => s.stepName === 'TEST_STEP_1');
    healthCheck.tests.storageUpdate = updatedStep?.status === 'completed';
    
    if (!healthCheck.tests.storageUpdate) {
      healthCheck.errors.push(`Step update failed: ${updatedStep?.status}`);
    }
    
    // Test 4: Direct KV connection test
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      try {
        const testKey = `health_${Date.now()}`;
        const response = await fetch(`${process.env.KV_REST_API_URL}/set/${testKey}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.KV_REST_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ value: 'test' }),
        });
        
        healthCheck.tests.kvConnection = response.ok;
        
        if (!response.ok) {
          healthCheck.errors.push(`KV connection failed: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        healthCheck.errors.push(`KV connection error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
  } catch (error) {
    healthCheck.errors.push(`Health check failed: ${error instanceof Error ? error.message : String(error)}`);
    console.error('[HealthCheck] Error:', error);
  }
  
  const allPassed = Object.values(healthCheck.tests).every(test => test === true);
  
  return NextResponse.json({
    success: allPassed,
    message: allPassed ? 'All debug storage tests passed' : 'Some debug storage tests failed',
    data: healthCheck
  }, {
    status: allPassed ? 200 : 503
  });
}