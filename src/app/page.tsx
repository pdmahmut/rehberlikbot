import RPDYonlendirme from "@/components/RPDYonlendirme";
import ConfigurationStatus from "@/components/ConfigurationStatus";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  return (
    <>
      <RPDYonlendirme />
      {/* Sayfanın en altında sistem durumu marquee - Mobilde gizli (sticky butonla çakışmasın) */}
      <div className="mt-8 pb-24 lg:pb-4 hidden lg:block">
        <ConfigurationStatus />
      </div>
      <Toaster />
    </>
  );
}

