import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist Node tarafinda kendi worker dosyasini yukluyor; Next paketlerse
  //  worker bulunamiyor. Paketleme disinda birakiliyor.
  serverExternalPackages: ["pdfjs-dist"],
  // pdfjs worker dosyasi paketleme disinda kaldigi icin Vercel dagitimina
  // otomatik dahil edilmiyordu; acikca ekleniyor.
  outputFileTracingIncludes: {
    "/api/class-list/preview": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
