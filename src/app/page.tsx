import RPDYonlendirme from "@/components/RPDYonlendirme";
import ConfigurationStatus from "@/components/ConfigurationStatus";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <>
      <RPDYonlendirme />
      {/* Sayfanın en altında sistem durumu marquee */}
      <div className="mt-8 mb-20 lg:mb-4">
        <ConfigurationStatus />
      </div>
      <Toaster />
    </>
  );
}

