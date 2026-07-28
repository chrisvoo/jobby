import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['@duckdb/node-api', '@react-pdf/renderer', 'unpdf'],
}

export default nextConfig
