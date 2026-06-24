import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { safeLocalStorage, safeSessionStorage } from "@/lib/safeStorage";
import { safeRandomId } from "@/lib/browserCompat";

const VisitLogger = () => {
  useEffect(() => {
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
  }, []);
  return null;
};

export default VisitLogger;
