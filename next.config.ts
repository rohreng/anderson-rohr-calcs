import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` uses native Node APIs — keep it external (native require) so it is
  // traced into serverless functions on Vercel instead of being bundled.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
