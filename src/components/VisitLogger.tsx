import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage, safeSessionStorage } from "@/lib/safeStorage";
import { safeRandomId } from "@/lib/browserCompat";

const VisitLogger = () => {
  useEffect(() => {
    if (safeSessionStorage.getItem("kt_visit_logged") === "1") return;

    const run = () => {
      try {
        if (safeSessionStorage.getItem("kt_visit_logged") === "1") return;
        let visitorId = safeLocalStorage.getItem("kt_visitor_id");
        if (!visitorId) {
          visitorId = safeRandomId("visitor");
          safeLocalStorage.setItem("kt_visitor_id", visitorId);
        }
        supabase
          .from("site_visits")
          .insert({ path: window.location.pathname, visitor_id: visitorId })
          .then(() => {}, () => {});
        safeSessionStorage.setItem("kt_visit_logged", "1");
      } catch {
        // ignore
      }
    };

    // Defer to idle time so the visit insert never competes with the initial
    // render or the bootstrap RPC.
    const ric: any = (window as any).requestIdleCallback;
    if (typeof ric === "function") {
      const handle = ric(run, { timeout: 4000 });
      return () => {
        const cic: any = (window as any).cancelIdleCallback;
        if (typeof cic === "function") cic(handle);
      };
    }
    const t = window.setTimeout(run, 1500);
    return () => window.clearTimeout(t);
  }, []);

  return null;
};

export default VisitLogger;
