import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // A lockfile higher up the disk confuses Next's workspace-root detection.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
