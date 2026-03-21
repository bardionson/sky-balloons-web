/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow ipfs.io for NFT image previews
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ipfs.io",
      },
    ],
  },
};

export default nextConfig;
