import { NextRequest, NextResponse } from 'next/server';
import { updateJobStatus, createResearchRequest } from '@/lib/db';
import { sendPersonaReport } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email = 'ben.perry@gmail.com', forceEmail = false } = await request.json();
    
    console.log(`🧪 Creating and force-completing test job for ${email}`);
    
    // Create a test job
    const jobId = `force_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create research request
    const researchRequest = await createResearchRequest({
      jobId,
      websiteUrl: 'https://groundluxe.com',
      amazonUrl: 'https://amazon.com/dp/B07RLNS58H',
      keywords: 'grounding sheets',
      email,
      competitorUrls: ['https://competitor1.com'],
      planId: 'comprehensive',
      planName: 'Comprehensive Analysis',
      discountCode: 'TEST',
      paymentSessionId: 'force_test_session',
      amountPaid: 0,
      originalPrice: 9900,
      finalPrice: 0,
      isFree: true
    });

    console.log(`✅ Test job created: ${jobId}`);

    // Create a sample persona report
    const samplePersonaReport = `
# Customer Persona Analysis - Test Report

## Executive Summary
Based on comprehensive analysis of grounding sheets market research, we've identified your ideal customer profile with high confidence.

## Primary Customer Persona: "Wellness-Seeking Professional"

### Demographics
- Age: 35-55 years old
- Income: $50,000-$100,000 annually
- Location: Urban and suburban areas
- Education: College-educated
- Family Status: Often parents or caregivers

### Psychographic Profile
- Health-conscious and proactive about wellness
- Values natural solutions over pharmaceuticals
- Skeptical but willing to try evidence-based alternatives
- Seeks quality sleep and stress reduction
- Active on health and wellness communities

### Key Pain Points
- Poor sleep quality affecting daily performance
- Chronic stress and anxiety
- Inflammation and recovery issues
- Electromagnetic sensitivity concerns
- Desire for natural health solutions

### Behavioral Patterns
- Researches products thoroughly before purchasing
- Reads reviews and testimonials extensively
- Influenced by scientific studies and expert opinions
- Price-conscious but willing to invest in quality
- Shares positive experiences with others

### Decision Triggers
- Sleep quality deterioration
- Health professional recommendations
- Positive testimonials from trusted sources
- Scientific backing and research data

### Marketing Recommendations
- Emphasize scientific research and studies
- Highlight sleep quality improvements
- Use testimonials from real customers
- Position as natural wellness solution
- Focus on quality of life benefits

## Data Quality: High Confidence
This analysis is based on comprehensive market research and customer data patterns.

Generated on: ${new Date().toLocaleDateString()}
Job ID: ${jobId}
`;

    // Save the persona analysis to the database
    await updateJobStatus(jobId, 'completed');
    
    // Store persona in research_requests table
    const { saveJobData } = await import('@/lib/db');
    await saveJobData(jobId, 'persona_profile', {
      persona: samplePersonaReport,
      dataQuality: {
        confidence: 'high',
        score: 95
      },
      metadata: {
        generated: new Date().toISOString(),
        jobId,
        testJob: true
      }
    });

    console.log(`📄 Persona report saved for job ${jobId}`);

    let emailResult = null;
    if (forceEmail) {
      // Send the email
      console.log(`📧 Sending persona report email to ${email}`);
      
      try {
        const emailSent = await sendPersonaReport({
          jobId,
          email,
          websiteUrl: 'https://groundluxe.com',
          keywords: 'grounding sheets',
          personaReport: samplePersonaReport,
          planName: 'Comprehensive Analysis',
          analysisDate: new Date().toLocaleDateString()
        });

        emailResult = {
          attempted: true,
          success: emailSent,
          message: emailSent ? 'Email sent successfully' : 'Email sending failed'
        };

        if (emailSent) {
          console.log(`✅ Email sent successfully to ${email}`);
        } else {
          console.error(`❌ Email failed to send to ${email}`);
        }
      } catch (emailError) {
        console.error(`Email error:`, emailError);
        emailResult = {
          attempted: true,
          success: false,
          error: emailError instanceof Error ? emailError.message : 'Unknown error'
        };
      }
    }

    return NextResponse.json({
      success: true,
      jobId,
      message: 'Test job force-completed successfully',
      details: {
        researchRequestId: researchRequest.id,
        personaGenerated: true,
        emailResult,
        testUrls: {
          personaApi: `/api/jobs/${jobId}/persona`,
          jobStatus: `/api/debug/job-status?jobId=${jobId}`,
          successPage: `/payment/success?session_id=test&jobId=${jobId}`
        }
      },
      instructions: [
        '1. Check the persona API endpoint to verify the report is accessible',
        '2. Visit the success page to see if the report displays correctly',
        '3. If email was sent, check your inbox',
        '4. Use job status endpoint to verify completion'
      ]
    });

  } catch (error) {
    console.error('Force complete job error:', error);
    return NextResponse.json({
      error: 'Failed to force complete job',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Force Complete Job Test Endpoint',
    usage: {
      method: 'POST',
      body: {
        email: 'email@example.com (optional, defaults to ben.perry@gmail.com)',
        forceEmail: 'true/false (optional, set to true to test email sending)'
      }
    },
    description: 'Creates a test job, generates a sample persona report, and optionally sends email'
  });
}