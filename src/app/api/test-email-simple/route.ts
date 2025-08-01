import { NextRequest, NextResponse } from 'next/server';
import { sendPersonaReport } from '@/lib/email';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ 
        error: 'Email parameter required. Use: ?email=your@email.com' 
      }, { status: 400 });
    }

    console.log(`Testing email delivery to: ${email}`);

    // Test the email service
    const emailSent = await sendPersonaReport({
      jobId: 'test_' + Date.now(),
      email,
      websiteUrl: 'https://example.com',
      keywords: 'test, email, verification',
      personaReport: `# Test Persona Report

This is a test email to verify that the Resend email service is working correctly.

## Test Results
- ✅ Email service configuration
- ✅ Template rendering
- ✅ Resend API integration
- ✅ Professional email formatting

## Next Steps
If you received this email, the persona analysis system is ready to send your detailed customer research reports!

This test was generated on ${new Date().toLocaleString()}.`,
      planName: 'Test Plan',
      analysisDate: new Date().toLocaleDateString()
    });

    console.log(`Email send result: ${emailSent}`);

    return NextResponse.json({
      success: emailSent,
      message: emailSent 
        ? `Test email sent successfully to ${email}` 
        : `Failed to send test email to ${email}`,
      timestamp: new Date().toISOString(),
      resendConfigured: !!process.env.RESEND_API_KEY
    });

  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Email test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      resendConfigured: !!process.env.RESEND_API_KEY
    }, { status: 500 });
  }
}