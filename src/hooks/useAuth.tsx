import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let checkedUserId: string | null = null;

    const handleSession = (newSession: Session | null) => {
      setSession(newSession);
      const uid = newSession?.user?.id ?? null;
      if (uid) {
        if (checkedUserId === uid) {
          // already checked for this user in this tab session
          setLoading(false);
          return;
        }
        checkedUserId = uid;
        // Defer async role check to avoid deadlocks
        setTimeout(async () => {
          await checkAdmin(uid);
          setLoading(false);
        }, 0);
      } else {
        checkedUserId = null;
        setIsAdmin(false);
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      handleSession(s);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => handleSession(s));

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    // Cache admin status in sessionStorage to avoid repeat queries on route changes / remounts
    const cacheKey = `isAdmin:${userId}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached !== null) {
        setIsAdmin(cached === "1");
        return;
      }
    } catch {}
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const admin = !!data;
    setIsAdmin(admin);
    try { sessionStorage.setItem(cacheKey, admin ? "1" : "0"); } catch {}
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
