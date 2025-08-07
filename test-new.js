const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('Fresh test of Prisma client:');
console.log('All props:', Object.getOwnPropertyNames(prisma));

// Try accessing each expected table
const expectedTables = ['analysis', 'analysisStep', 'websiteContent', 'aIResponse', 'report', 'processingEvent'];
expectedTables.forEach(table => {
  console.log(`${table}:`, table in prisma);
});