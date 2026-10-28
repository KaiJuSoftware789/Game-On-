"use client";

import { useState } from "react";
import type { Game } from "@/lib/types";
import { Icon } from "./icons";

const samples = [
  { title: "A relaxed squad for a few rounds", description: "Warm up, share a few laughs, and enjoy some casual games. All skill levels welcome.", players: 2 },
  { title: "One more for the team", description: "A friendly session with teamwork and good communication. Bring your favorite loadout.", players: 1 },
  { title: "Build something great together", description: "Meet a few new teammates for a laid-back evening of playing and exploring.", players: 3 },
];

export function DemoTickets({ games, gameFilter }: { games: Game[]; gameFilter: string }) {
  const [opened, setOpened] = useState<number | null>(null);
  const available = gameFilter === "all" ? games : games.filter(game => String(game.id) === gameFilter);
  const demoGames = available.length ? available.slice(0, 3) : gameFilter === "all" ? [{ id: -1, name: "Gaming session", platform: "Online" }] : [];
  if (!demoGames.length) return null;
  return <section className="demo-sessions" aria-labelledby="demo-sessions-heading">
    <div className="section-heading"><h2 id="demo-sessions-heading">Sample sessions</h2><span className="count-badge">Demo</span></div>
    <p className="demo-explanation">Explore example tickets. These are demos, with no real players or sessions to join.</p>
    <div className="ticket-grid">{demoGames.map((game, index) => {
      const sample = samples[index];
      return <article className="ticket-card" key={game.id}>
        <div className="ticket-topline"><span className="game-tag">{game.name}</span><span className="demo-label">Demo ticket</span></div>
        <h3>{sample.title}</h3><p className="ticket-description">{sample.description}</p>
        <div className="ticket-details"><span><Icon name="user" />{sample.players} players wanted</span><span><Icon name="globe" />North America</span><span><Icon name="game" />{game.platform}</span></div>
        <div className="ticket-footer"><button className="button secondary" aria-expanded={opened === game.id} aria-controls={`demo-notice-${game.id}`} onClick={() => setOpened(opened === game.id ? null : game.id)}>{opened === game.id ? "Close preview" : "Preview demo session"}<Icon name="arrow" /></button></div>
        {opened === game.id && <div className="demo-notice" id={`demo-notice-${game.id}`} role="status"><strong>This session is just a demo.</strong><p>This sample shows how a ticket works. There is no live lobby, host, or invite. Create a ticket to start a real session.</p></div>}
      </article>;
    })}</div>
  </section>;
}
