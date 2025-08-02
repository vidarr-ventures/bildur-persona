const { sql } = require('@vercel/postgres');

async function addAmazonUrlColumn() {
  try {
    console.log('🔧 Adding amazon_url column to research_requests...');

    // Add amazon_url column if it doesn't exist
    await sql.query(`
      ALTER TABLE research_requests 
      ADD COLUMN IF NOT EXISTS amazon_url TEXT
    `);

    console.log('✅ amazon_url column added successfully');

    // Verify the column was added
    const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'research_requests' AND column_name = 'amazon_url'
    `;

    if (columns.rows.length > 0) {
      console.log('✅ Verified: amazon_url column exists');
    } else {
      console.log('❌ Warning: amazon_url column not found after creation');
    }

  } catch (error) {
    console.error('❌ Failed to add amazon_url column:', error);
    process.exit(1);
  }
}

// Check if we're running this directly
if (require.main === module) {
  addAmazonUrlColumn();
}

module.exports = { addAmazonUrlColumn };