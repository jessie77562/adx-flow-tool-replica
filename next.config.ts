import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const githubPagesBasePath = "/adx-flow-tool-replica";

const nextConfig: NextConfig = {
  output: isGitHubPages ? "export" : undefined,
  assetPrefix: isGitHubPages ? githubPagesBasePath : "",
  trailingSlash: isGitHubPages,
};

export default nextConfig;
