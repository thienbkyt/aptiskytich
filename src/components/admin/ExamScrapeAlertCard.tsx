import { useQuery } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AlertRow {
  user_id: string;
  email: string | null;
  day: string;
  set_count: number;
  submissions: number;
}

/**
 * Admin-only card listing accounts that opened more than 100 distinct exam sets
 * in a single day over the last 7 days (possible content scraping).
 */
const ExamScrapeAlertCard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["examAccessAlerts"],
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await (supabase as any).rpc("get_exam_access_alerts");
      if (error) throw error;
      return (data as AlertRow[]) ?? [];
    },
  });

  const rows = data ?? [];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-heading font-bold text-foreground">Nghi cào đề</h2>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">7 ngày qua không có tài khoản nào bất thường.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-medium">Email</th>
                <th className="py-1 pr-3 font-medium">Ngày</th>
                <th className="py-1 pr-3 font-medium">Số đề mở</th>
                <th className="py-1 font-medium">Bài nộp</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.user_id}-${r.day}`} className="border-t border-border">
                  <td className="py-1 pr-3 text-foreground">{r.email ?? r.user_id}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{r.day}</td>
                  <td className="py-1 pr-3 font-semibold text-foreground">{r.set_count}</td>
                  <td className="py-1 text-muted-foreground">{r.submissions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ExamScrapeAlertCard;
