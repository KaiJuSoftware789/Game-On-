import Link from "next/link";

export default function PlayerNotFound() {
  return (
    <div className="panel empty-state">
      <h1>Player not found</h1>
      <p>This profile isn’t available.</p>
      <Link href="/" className="button primary">
        Back to live tickets
      </Link>
    </div>
  );
}
