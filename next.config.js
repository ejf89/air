/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "air-prod.imgix.net" },
      { protocol: "https", hostname: "air-original.imgix.net" },
    ],
  },
}

module.exports = nextConfig
