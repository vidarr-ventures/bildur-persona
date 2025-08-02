import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function GET() {
  try {
    console.log('🔍 Checking status constraint on research_requests table...');

    // Check what constraints exist on the status column
    const constraints = await sql`
      SELECT 
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_definition
      FROM pg_constraint 
      WHERE conrelid = 'research_requests'::regclass 
      AND conname LIKE '%status%'
    `;

    // Check what the current status values are allowed
    const statusInfo = await sql`
      SELECT 
        column_name,
        data_type,
        column_default,
        is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'research_requests' 
      AND column_name = 'status'
    `;

    return NextResponse.json({
      message: 'Status constraint analysis',
      statusColumn: statusInfo.rows,
      constraints: constraints.rows,
      analysis: {
        hasStatusColumn: statusInfo.rows.length > 0,
        hasStatusConstraint: constraints.rows.length > 0,
        constraintDetails: constraints.rows.map(c => c.constraint_definition)
      }
    });

  } catch (error) {
    console.error('Constraint check error:', error);
    return NextResponse.json({
      error: 'Failed to check constraints',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action = 'fix_constraint' } = await request.json();
    
    console.log(`🔧 Attempting to fix status constraint with action: ${action}`);

    if (action === 'fix_constraint') {
      // Drop existing status constraint if it exists
      try {
        console.log('Dropping existing status constraint...');
        await sql`ALTER TABLE research_requests DROP CONSTRAINT IF EXISTS research_requests_status_check`;
        console.log('✅ Dropped existing constraint');
      } catch (error) {
        console.log('⚠️ No existing constraint to drop or drop failed:', error);
      }

      // Add the correct constraint with proper status values
      try {
        console.log('Adding corrected status constraint...');
        await sql`
          ALTER TABLE research_requests 
          ADD CONSTRAINT research_requests_status_check 
          CHECK (status IN ('queued', 'processing', 'completed', 'failed'))
        `;
        console.log('✅ Added corrected status constraint');
      } catch (error) {
        console.error('❌ Failed to add constraint:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to add constraint',
          details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }

      // Verify the constraint was added correctly
      const verifyConstraints = await sql`
        SELECT 
          conname as constraint_name,
          pg_get_constraintdef(oid) as constraint_definition
        FROM pg_constraint 
        WHERE conrelid = 'research_requests'::regclass 
        AND conname LIKE '%status%'
      `;

      return NextResponse.json({
        success: true,
        message: 'Status constraint fixed successfully',
        action: 'fix_constraint',
        results: {
          constraintDropped: true,
          constraintAdded: true,
          finalConstraints: verifyConstraints.rows
        }
      });

    } else if (action === 'test_insert') {
      // Test if we can now insert a record with 'queued' status
      const testJobId = `test_constraint_${Date.now()}`;
      
      try {
        await sql`
          INSERT INTO research_requests (
            job_id, website_url, keywords, email, competitor_urls,
            plan_id, plan_name, payment_session_id, amount_paid,
            original_price, final_price, is_free, status
          ) VALUES (
            ${testJobId}, 'https://test.com', 'test keywords', 'test@test.com', '{}',
            'test', 'Test Plan', 'test_session', 0,
            0, 0, true, 'queued'
          )
        `;
        
        // Clean up test record
        await sql`DELETE FROM research_requests WHERE job_id = ${testJobId}`;
        
        return NextResponse.json({
          success: true,
          message: 'Status constraint test passed',
          action: 'test_insert',
          result: 'Can successfully insert records with queued status'
        });

      } catch (error) {
        return NextResponse.json({
          success: false,
          message: 'Status constraint test failed',
          action: 'test_insert',
          error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      error: 'Unknown action',
      validActions: ['fix_constraint', 'test_insert']
    }, { status: 400 });

  } catch (error) {
    console.error('Status constraint fix error:', error);
    return NextResponse.json({
      error: 'Failed to fix status constraint',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}