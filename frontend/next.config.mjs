/** @type {import('next').NextConfig} */
const nextConfig = {
  /* xóa toàn bộ wrapper withTailwind */
  reactStrictMode: false,
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
