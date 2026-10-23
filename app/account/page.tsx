import { Account } from "@/components/account";
import { getSignInProviders, safeNextPath } from "@/lib/auth-config";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [config, params] = await Promise.all([
    getSignInProviders(),
    searchParams,
  ]);
  return (
    <Account
      providers={config.providers}
      configError={config.error}
      callbackError={Boolean(params.error)}
      next={safeNextPath(typeof params.next === "string" ? params.next : null)}
    />
  );
}
