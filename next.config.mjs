/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'files.lighthouse.storage' },
      { protocol: 'https', hostname: 'dweb.link' },
      { protocol: 'https', hostname: 'ipfs.io' },
    ],
  },
}

export default nextConfig
