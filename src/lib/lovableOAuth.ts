import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";

const lovableAuth = createLovableAuth({
  oauthBrokerUrl: "https://aptiskytich.lovable.app/~oauth/initiate",
});

export async function signInWithGoogle(redirectTo: string) {
  const result = await lovableAuth.signInWithOAuth("google", { redirect_uri: redirectTo });
  if ((result as any).redirected) return { redirected: true as const };
  if (result.error) return { error: result.error };
  await supabase.auth.setSession(result.tokens!);
  return { ok: true as const };
}

export async function completeOAuthRedirect(): Promise<boolean> {
  try {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const pick = (k: string) => hash.get(k) || query.get(k);

    const access_token = pick("access_token");
    const refresh_token = pick("refresh_token");

    if (!access_token || !refresh_token) {
      if (window.location.search || window.location.hash) {
        console.warn("[OAuth] Quay về nhưng không thấy token:", {
          search: window.location.search,
          hash: window.location.hash,
        });
      }
      return false;
    }

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    window.history.replaceState({}, "", window.location.pathname);
    return !error;
  } catch {
    return false;
  }
}
