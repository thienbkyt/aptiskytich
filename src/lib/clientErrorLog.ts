import { supabase } from "@/integrations/supabase/client";

const lastSentAt = new Map<string, number>();

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
    const error_message = String(anyErr?.message ?? anyErr ?? "").slice(0, 2000);
    const key = context + "|" + error_message + "|" + JSON.stringify(meta ?? {});
    const now = Date.now();
    const prev = lastSentAt.get(key);
    if (prev && now - prev < 60000) return;
    lastSentAt.set(key, now);

    const payload = {
      context,
      error_name: String(anyErr?.name || typeof err).slice(0, 200),
      error_message,
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
