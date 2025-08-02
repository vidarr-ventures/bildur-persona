import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  console.log('=== SEND TEST EMAIL ENDPOINT CALLED ===');
  
  try {
    const body = await request.json();
    const { email = 'ben.perry@gmail.com' } = body;
    
    console.log('Request body:', body);
    console.log('Target email:', email);
    console.log('RESEND_API_KEY exists:', !!process.env.RESEND_API_KEY);
    console.log('RESEND_API_KEY prefix:', process.env.RESEND_API_KEY?.substring(0, 7));
    
    if (!process.env.RESEND_API_KEY) {
      console.error('❌ RESEND_API_KEY not found in environment');
      return NextResponse.json({
        error: 'Email service not configured',
        details: 'RESEND_API_KEY missing'
      }, { status: 500 });
    }
    
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('✅ Resend client initialized');
    
    try {
      console.log('📧 Attempting to send email...');
      const result = await resend.emails.send({
        from: 'Persona Generator <reports@bildur.ai>',
        to: [email],
        subject: 'Test Email - Working!',
        html: '<h1>Email Test Successful!</h1><p>This email was sent successfully from the API endpoint.</p>',
        text: 'Email Test Successful! This email was sent successfully from the API endpoint.'
      });
      
      console.log('📬 Resend API Response:', result);
      
      if (result.error) {
        console.error('❌ Resend returned error:', result.error);
        return NextResponse.json({
          error: 'Failed to send email',
          details: result.error
        }, { status: 500 });
      }
      
      console.log('✅ Email sent successfully! ID:', result.data?.id);
      return NextResponse.json({
        success: true,
        emailId: result.data?.id,
        message: `Email sent to ${email}`
      });
      
    } catch (sendError) {
      console.error('❌ Error calling Resend API:', sendError);
      return NextResponse.json({
        error: 'Failed to call Resend API',
        details: sendError instanceof Error ? sendError.message : 'Unknown error'
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ Endpoint error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  console.log('=== GET request to send-test-email ===');
  return NextResponse.json({
    message: 'Use POST method to send test email',
    example: {
      email: 'your@email.com'
    }
  });
}