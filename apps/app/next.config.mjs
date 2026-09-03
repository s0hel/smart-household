/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@household/ui", "@household/domain", "@household/db", "@household/ai"],
};

export default nextConfig;
