import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist Node tarafinda kendi worker dosyasini yukluyor; Next paketlerse
  //  worker bulunamiyor. Paketleme disinda birakiliyor.
  serverExternalPackages: ["pdfjs-dist"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
