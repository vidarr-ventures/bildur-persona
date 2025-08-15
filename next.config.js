/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ['openai', '@google/generative-ai'],
  env: {
    API_TIMEOUT: '300000', // 5 minutes
  },
}

module.exports = nextConfig
