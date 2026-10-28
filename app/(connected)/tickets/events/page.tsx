import type { Metadata } from "next";
import EventsBrowser from "@/app/_components/events-browser";
export const metadata: Metadata = {
  title: "Local events · Game On",
  description:
    "Find gaming tournaments and in-person sessions near your ZIP code. Create an event and share it with your community.",
};
export default function EventsPage() {
  return <div className="discovery-pages"><EventsBrowser /></div>;
}
