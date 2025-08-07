const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    // Try to query the information schema to see what tables exist
    const result = await prisma.$queryRaw`
      SELECT table_name::text 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;
    
    console.log('Tables in database:');
    console.log(result);
    
    if (Array.isArray(result)) {
      result.forEach(row => {
        console.log('- ' + row.table_name);
      });
    }

    // Try a basic analysis query
    const analyses = await prisma.analysis.findMany();
    console.log(`\nFound ${analyses.length} analyses`);

    // Try a basic report query
    const reports = await prisma.report.findMany();
    console.log(`Found ${reports.length} reports`);

  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Full error:', error);
  }
}

checkDatabase();