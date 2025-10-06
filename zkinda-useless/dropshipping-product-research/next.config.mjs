/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
      remotePatterns: [
          {
            protocol: 'https',
            hostname: '**.aliexpress-media.com',
            port: '',
          },
      ],
  },
  experimental: {
      serverComponentsExternalPackages: ['puppeteer-core', 'puppeteer'],
  },
};

export default nextConfig;