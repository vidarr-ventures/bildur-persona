import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || 'ben.perry@gmail.com';
    
    console.log('Testing email with Resend...');
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);
    
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not configured'
      }, { status: 500 });
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log(`Sending test email to: ${email}`);
    
    const result = await resend.emails.send({
      from: 'Persona Generator <reports@bildur.ai>',
      to: [email],
      subject: 'Test Email - Persona Generator System',
      html: `
        <h1>🎉 Email Test Successful!</h1>
        <p>This is a test email to verify that your Resend email service is working correctly.</p>
        <h2>Configuration Status:</h2>
        <ul>
          <li>✅ Resend API Key: Configured</li>
          <li>✅ DNS Records: Set up for bildur.ai</li>
          <li>✅ Email Service: Working</li>
          <li>✅ Template Rendering: Working</li>
        </ul>
        <p><strong>Next Step:</strong> Your persona analysis system is ready to send detailed reports!</p>
        <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
      `,
      text: `
Email Test Successful!

This is a test email to verify that your Resend email service is working correctly.

Configuration Status:
✅ Resend API Key: Configured
✅ DNS Records: Set up for bildur.ai
✅ Email Service: Working
✅ Template Rendering: Working

Next Step: Your persona analysis system is ready to send detailed reports!

Sent at: ${new Date().toLocaleString()}
      `
    });
    
    console.log('Resend result:', result);
    
    if (result.error) {
      console.error('Resend error:', result.error);
      return NextResponse.json({
        success: false,
        error: 'Resend API error',
        details: result.error
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      emailId: result.data?.id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Email test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}