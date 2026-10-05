import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { syncMarathonFromServer, reconcileMarathonFromHistory } from "@/lib/marathonProgress";

/** Khi mở trang luyện tập: kéo tiến độ Marathon từ server về (đổi máy / qua ngày vẫn làm tiếp). */
export function useMarathonServerSync(onChanged: () => void) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user?.id) return;
    let alive = true;
    void (async () => {
      const pulled = await syncMarathonFromServer();
      const fixed = await reconcileMarathonFromHistory();
      if (alive && (pulled || fixed)) onChanged();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
