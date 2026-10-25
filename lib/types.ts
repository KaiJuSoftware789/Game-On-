export type Game = {
  id: number;
  name: string;
  platform: string;
};

export type Ticket = {
  id: string;
  host_id: string;
  game_id: number;
  title: string;
  description: string;
  players_needed: number;
  region: string;
  invite_url: string;
  status: "open" | "closed";
  created_at: string;
  expires_at: string;
};

export const ticketColumns =
  "id, host_id, game_id, title, description, players_needed, region, invite_url, status, created_at, expires_at";

export function safeInviteUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
