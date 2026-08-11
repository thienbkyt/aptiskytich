import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget client error log. NEVER throws, never awaits the caller's
 * critical path — used to diagnose grading kick-off failures (closed tab,
 * offline, edge timeout) that previously vanished silently.
 */
export function logClientError(
  context: string,
  err: unknown,
  meta?: Record<string, unknown>,
): void {
  try {
    const anyErr = err as any;
    const payload = {
      context,
      error_name: String(anyErr?.name || typeof err).slice(0, 200),
      error_message: String(anyErr?.message ?? anyErr ?? "").slice(0, 2000),
      meta: (meta ?? {}) as any,
    };
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await (supabase as any)
          .from("client_error_logs")
          .insert({ ...payload, user_id: user.id });
      } catch {
        /* swallow — logging must never affect the submission flow */
      }
    })();
  } catch {
    /* swallow */
  }
}
