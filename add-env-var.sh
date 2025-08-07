#!/bin/bash

# Add DIRECT_URL environment variable to Vercel
echo "postgres://neondb_owner:npg_A2nkOVWez3wa@ep-spring-firefly-a4gxjxf5.us-east-1.aws.neon.tech/neondb?sslmode=require" | vercel env add DIRECT_URL production

echo "Environment variable added successfully"