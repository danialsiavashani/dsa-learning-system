import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The first concept in the curriculum is the landing page.
  redirects() {
    return [{ source: "/", destination: "/arrays", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
