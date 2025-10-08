/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // ⚠️ Warning: this will allow production builds even if ESLint errors exist
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
