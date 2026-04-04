/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.lighthouse.storage' },
      { protocol: 'https', hostname: 'dweb.link' },
      { protocol: 'https', hostname: 'ipfs.io' },
    ],
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, 'pino-pretty': false };
    return config;
  },
}

export default nextConfig
