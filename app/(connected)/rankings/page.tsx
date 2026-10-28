import type { Metadata } from "next";
import RankingsBrowser from "@/app/_components/rankings-browser";

export const metadata: Metadata = {
  title: "Rankings · Game On",
  description: "View players’ in-game ranks, starting with VALORANT.",
};

export default function RankingsPage() {
  return <div className="discovery-pages"><RankingsBrowser /></div>;
}
