/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@prisma/client',
    'prisma',
    '@langchain/langgraph',
    '@langchain/core',
    '@langchain/google-genai',
    '@langchain/tavily',
    'bcryptjs',
  ],
};

export default nextConfig;
