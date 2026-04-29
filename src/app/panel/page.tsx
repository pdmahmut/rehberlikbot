import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function PanelPage() {
  const session = await getSession();

  if (session?.role === "teacher") {
    redirect("/panel/ogrenci-yonlendirmesi");
  }

  redirect("/panel/takvim");
}
