// Shared usage logger for all edge functions.
// Logs to public.usage_events with cost calculated from public.pricing_config.
// Fail-soft: never throws — logging errors are swallowed.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

type PricingRow = {
  service: string;
  model: string | null;
  unit_type: string;
  price_per_unit: number;
  unit_scale: number;
  usd_to_vnd_rate: number;
  is_active: boolean;
};

let pricingCache: PricingRow[] | null = null;
let pricingCacheAt = 0;
const PRICING_TTL_MS = 5 * 60 * 1000; // 5 min

function getServiceClient(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

async function loadPricing(supabase: SupabaseClient): Promise<PricingRow[]> {
  const now = Date.now();
  if (pricingCache && now - pricingCacheAt < PRICING_TTL_MS) return pricingCache;
  const { data, error } = await supabase
    .from("pricing_config")
    .select("service,model,unit_type,price_per_unit,unit_scale,usd_to_vnd_rate,is_active")
    .eq("is_active", true);
  if (error || !data) return pricingCache || [];
  pricingCache = data as PricingRow[];
  pricingCacheAt = now;
  return pricingCache;
}

function findRate(
  rows: PricingRow[],
  service: string,
  model: string | null,
  unitType: string,
): PricingRow | undefined {
  // Prefer exact model match, fall back to service+unit_type with null model
  return (
    rows.find(r => r.service === service && r.model === model && r.unit_type === unitType) ||
    rows.find(r => r.service === service && r.model === null && r.unit_type === unitType)
  );
}

export interface UsageLogInput {
  service: string;
  event_type: string;
  model?: string | null;
  units: number;
  unit_type: string;
  source_function?: string;
  metadata?: Record<string, unknown>;
}

export async function logUsage(input: UsageLogInput): Promise<void> {
  try {
    const supabase = getServiceClient();
    if (!supabase) return;
    const pricing = await loadPricing(supabase);
    const rate = findRate(pricing, input.service, input.model ?? null, input.unit_type);
    let costVnd = 0;
    if (rate) {
      // cost USD = units / unit_scale * price_per_unit
      const usd = (input.units / Number(rate.unit_scale)) * Number(rate.price_per_unit);
      costVnd = usd * Number(rate.usd_to_vnd_rate);
    }
    await supabase.from("usage_events").insert({
      service: input.service,
      event_type: input.event_type,
      model: input.model ?? null,
      units: input.units,
      unit_type: input.unit_type,
      estimated_cost_vnd: costVnd,
      source_function: input.source_function ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.error("[usage-logger] failed:", e);
  }
}

/**
 * Log AI chat completion usage (input + output tokens) from Lovable AI Gateway response.
 */
export async function logAIUsage(args: {
  model: string;
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
  source_function: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!args.usage) return;
  const inputTokens = Number(args.usage.prompt_tokens || 0);
  const outputTokens = Number(args.usage.completion_tokens || 0);
  const tasks: Promise<void>[] = [];
  if (inputTokens > 0) {
    tasks.push(logUsage({
      service: "lovable_ai",
      event_type: "chat_completion",
      model: args.model,
      units: inputTokens,
      unit_type: "input_tokens",
      source_function: args.source_function,
      metadata: args.metadata,
    }));
  }
  if (outputTokens > 0) {
    tasks.push(logUsage({
      service: "lovable_ai",
      event_type: "chat_completion",
      model: args.model,
      units: outputTokens,
      unit_type: "output_tokens",
      source_function: args.source_function,
      metadata: args.metadata,
    }));
  }
  await Promise.all(tasks);
}

/**
 * Log a single edge function invocation (counted once per request).
 */
export async function logInvocation(funcName: string, metadata?: Record<string, unknown>): Promise<void> {
  await logUsage({
    service: "edge_function",
    event_type: "function_invocation",
    units: 1,
    unit_type: "calls",
    source_function: funcName,
    metadata,
  });
}
