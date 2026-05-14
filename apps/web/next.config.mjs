/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Webhook + jobs + dashboard API are all colocated in src/app/api — no rewrites needed.
  experimental: {
    // Lets server code import from workspace packages without bundling them.
    serverComponentsExternalPackages: ["pino", "pino-pretty"],
  },
};

export default nextConfig;
