import { TicketNavigation } from "@/components/ticket-navigation";

export default function TicketsLayout({ children }: { children: React.ReactNode }) {
  return <><TicketNavigation />{children}</>;
}
