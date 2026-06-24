import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeMatches } from "@/lib/browserCompat";

const InstallAppButton = () => {
  const [deferred, setDeferred] = useState<any>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (safeMatches("(display-mode: standalone)")) { setInstalled(true); return; }
    const onPrompt = (e: any) => { e.preventDefault(); setDeferred(e); };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !deferred) return null;

  const click = async () => { deferred.prompt(); await deferred.userChoice; setDeferred(null); };

  return (
    <Button onClick={click} variant="outline" size="sm" className="gap-1.5 border-[#CC1C01]/40 text-[#CC1C01] hover:bg-[#CC1C01]/10">
      <Download className="w-4 h-4" /> Tải về máy
    </Button>
  );
};

export default InstallAppButton;
