import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const VisitLogger = () => {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("kt_visit_logged") === "1") return;
      let visitorId = localStorage.getItem("kt_visitor_id");
      if (!visitorId) {
        visitorId = crypto.randomUUID();
        localStorage.setItem("kt_visitor_id", visitorId);
      }
      supabase
        .from("site_visits")
        .insert({ path: window.location.pathname, visitor_id: visitorId })
        .then(() => {}, () => {});
      sessionStorage.setItem("kt_visit_logged", "1");
    } catch {
      // ignore
    }
  }, []);
  return null;
};

export default VisitLogger;
