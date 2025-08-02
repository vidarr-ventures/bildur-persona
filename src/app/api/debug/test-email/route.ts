import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email = 'test@example.com' } = await request.json();
    
    console.log('🔧 Testing email delivery system...');
    console.log('Target email:', email);
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('RESEND_API_KEY length:', process.env.RESEND_API_KEY?.length || 0);

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'RESEND_API_KEY not configured',
        config: {
          hasApiKey: false,
          environment: process.env.NODE_ENV
        }
      }, { status: 500 });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    
    console.log('📧 Sending test email...');
    
    const result = await resend.emails.send({
      from: 'Persona Generator <reports@bildur.ai>',
      to: [email],
      subject: `Email Test - ${new Date().toLocaleString()}`,
      html: `
        <h1>✅ Email System Working!</h1>
        <p>This test email was sent successfully at ${new Date().toLocaleString()}</p>
        <h2>System Info:</h2>
        <ul>
          <li><strong>Domain:</strong> bildur.ai</li>
          <li><strong>Environment:</strong> ${process.env.NODE_ENV}</li>
          <li><strong>Vercel URL:</strong> ${process.env.VERCEL_URL || 'localhost'}</li>
        </ul>
        <p>If you received this email, the email delivery system is working correctly!</p>
      `,
      text: `
Email System Working!

This test email was sent successfully at ${new Date().toLocaleString()}

System Info:
- Domain: bildur.ai  
- Environment: ${process.env.NODE_ENV}
- Vercel URL: ${process.env.VERCEL_URL || 'localhost'}

If you received this email, the email delivery system is working correctly!
      `
    });

    console.log('📬 Email result:', result);

    if (result.error) {
      return NextResponse.json({
        success: false,
        error: 'Resend API error',
        details: result.error,
        config: {
          hasApiKey: true,
          apiKeyLength: process.env.RESEND_API_KEY?.length,
          environment: process.env.NODE_ENV
        }
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Test email sent successfully to ${email}`,
      emailId: result.data?.id,
      timestamp: new Date().toISOString(),
      config: {
        hasApiKey: true,
        domain: 'bildur.ai',
        environment: process.env.NODE_ENV
      }
    });

  } catch (error) {
    console.error('Email test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Email test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      config: {
        hasApiKey: !!process.env.RESEND_API_KEY,
        environment: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Email Test Endpoint',
    usage: 'POST with { "email": "your@email.com" }',
    config: {
      hasResendKey: !!process.env.RESEND_API_KEY,
      environment: process.env.NODE_ENV,
      domain: 'bildur.ai'
    }
  });
}