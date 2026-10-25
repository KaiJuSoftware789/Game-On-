import Link from "next/link";
import { AuthProvider } from "@/components/auth-provider";
import { AppShell } from "@/components/app-shell";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import "./connected.css";

export default function ConnectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!hasSupabaseConfig())
    return (
      <main style={{ padding: "3rem" }}>
        <h1>Online play · Coming soon</h1>
        <p>
          Connect Supabase to use live tickets, online accounts, and public
          player profiles.
        </p>
        <Link href="/">Explore local sessions</Link>
      </main>
    );
  return (
    <div className="live-app">
      <AuthProvider>
        <AppShell>{children}</AppShell>
      </AuthProvider>
    </div>
  );
}
