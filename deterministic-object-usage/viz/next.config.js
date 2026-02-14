/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["@vercel/beautiful-mermaid"],
};

module.exports = nextConfig;
