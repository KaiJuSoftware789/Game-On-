export type SignInProvider = {
  id: "google" | "discord" | `custom:${string}`;
  name: string;
  enabled: boolean;
};

export async function getSignInProviders(): Promise<{
  providers: SignInProvider[];
  error: boolean;
}> {
  const riotProvider = process.env.SUPABASE_RIOT_PROVIDER;
  const riotEnabled = Boolean(
    riotProvider && /^custom:[a-z0-9-]+$/.test(riotProvider),
  );
  let external: Record<string, boolean> = {};
  let error = false;
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
      {
        headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!response.ok) throw new Error("Auth settings unavailable");
    external = (await response.json()).external ?? {};
  } catch {
    error = true;
  }
  return {
    error,
    providers: [
      { id: "google", name: "Google", enabled: external.google === true },
      {
        id: riotEnabled ? (riotProvider as `custom:${string}`) : "custom:riot",
        name: "Riot Games",
        enabled: riotEnabled && !error,
      },
      { id: "discord", name: "Discord", enabled: external.discord === true },
    ],
  };
}

export function safeNextPath(value: string | null | undefined) {
  return ["/", "/games", "/account", "/tickets/new"].includes(value ?? "")
    ? value!
    : "/games";
}
