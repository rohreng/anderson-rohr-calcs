import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `pg` uses native Node APIs — keep it external (native require) so it is
  // traced into serverless functions on Vercel instead of being bundled.
  serverExternalPackages: ["pg"],
  async redirects() {
    return [
      { source: "/calcs/directly-welded-hss", destination: "/calcs/w-to-hss-column", permanent: true },
      { source: "/calcs/hss-connection-complete", destination: "/calcs/w-to-hss-column", permanent: true },
    ];
  },
};

export default nextConfig;
