import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface AiCreditGrant {
  id: string;
  amount: number;
  used: number;
  granted_at: string;
  expires_at: string | null;
  source: string;
  label: string;
}
export interface AiWallet {
  balance: number;
  nextExpiry: string | null;
  grants: AiCreditGrant[];
}
export interface AiCreditPack {
  key: string;
  label: string;
  credits: number;
  price_vnd: number;
  valid_days: number;
  badge: string | null;
}

const sb = supabase as any;

/** Ví lượt chấm AI mua thêm (dùng sau khi hết lượt ngày của gói). */
export function useAiWallet(enabled = true) {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<AiWallet | null>(null);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    if (!user || !enabled) { setWallet(null); return null; }
    setLoading(true);
    try {
      const { data, error } = await sb.rpc("get_my_ai_wallet");
      if (error) return null;
      const d = (data ?? {}) as any;
      const w: AiWallet = {
        balance: Number(d.balance ?? 0),
        nextExpiry: d.next_expiry ?? null,
        grants: Array.isArray(d.grants) ? d.grants : [],
      };
      setWallet(w);
      return w;
    } finally {
      setLoading(false);
    }
  }, [user, enabled]);

  useEffect(() => { void refetch(); }, [refetch]);
  useEffect(() => {
    const h = () => { void refetch(); };
    window.addEventListener("ai-wallet-updated", h);
    return () => window.removeEventListener("ai-wallet-updated", h);
  }, [refetch]);

  return { wallet, loading, refetch };
}

let packsCache: AiCreditPack[] | null = null;
export async function fetchCreditPacks(): Promise<AiCreditPack[]> {
  if (packsCache) return packsCache;
  const { data } = await sb
    .from("ai_credit_packs")
    .select("key,label,credits,price_vnd,valid_days,badge")
    .eq("active", true)
    .order("sort_order");
  packsCache = (data ?? []) as AiCreditPack[];
  return packsCache;
}

export const formatVnd = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;
export const formatDateVi = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Ho_Chi_Minh" });
};
