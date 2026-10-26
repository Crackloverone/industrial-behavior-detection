/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发和生产构建使用不同目录，避免 next build 覆盖正在运行的开发缓存。
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_BASE || 'http://localhost:8000'}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
