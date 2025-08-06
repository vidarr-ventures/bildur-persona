// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Mock environment variables for testing
process.env.NODE_ENV = 'test'
process.env.OPENAI_API_KEY = 'test-openai-key'
process.env.POSTGRES_URL = 'test-postgres-url'