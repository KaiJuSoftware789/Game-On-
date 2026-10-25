import type { Metadata } from "next";
import PlayerProfile from "../_components/player-profile";

export const metadata: Metadata = {
  title: "Your profile · Game On",
  description:
    "Your games, your stats, and the achievements that tell your story.",
};

export default function ProfilePage() {
  return <PlayerProfile />;
}
