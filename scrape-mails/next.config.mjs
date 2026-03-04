/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/format_DISABLED/**', '**/node_modules/**'],
    };
    return config;
  },
};

export default nextConfig;
