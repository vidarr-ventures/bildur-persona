import { NextRequest } from 'next/server';

/**
 * Validates internal API key from Authorization header
 * Used for worker-to-worker communication and internal calls
 */
export function validateInternalApiKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return !!(authHeader?.startsWith('Bearer ') && 
           authHeader.split(' ')[1] === process.env.INTERNAL_API_KEY);
}

/**
 * Authentication error response for unauthorized access
 */
export function createAuthErrorResponse() {
  return new Response(
    JSON.stringify({ 
      error: 'Unauthorized',
      message: 'Valid API key required for worker access' 
    }),
    { 
      status: 401, 
      headers: { 'Content-Type': 'application/json' } 
    }
  );
}