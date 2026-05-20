import type { AuthProviderSnapshot } from "@openchamber/plugin";

const PROVIDERS_ENDPOINT = "/api/auth/providers";

export async function fetchAuthProviderSnapshot(): Promise<AuthProviderSnapshot> {
  const response = await fetch(PROVIDERS_ENDPOINT, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch auth providers: ${response.status}`);
  }
  return response.json();
}
