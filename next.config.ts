import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phone testing over LAN (http://192.168.0.98:3000). Without this, Next.js 16
  // blocks dev client JS and onClick handlers never attach.
  allowedDevOrigins: ["192.168.0.98"],
};

export default nextConfig;
