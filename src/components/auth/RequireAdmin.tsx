import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import PageLoadingSkeleton from "@/components/layout/PageLoadingSkeleton";

/**
 * Client-side admin gate. Defense in depth on top of RLS.
 * - While auth/role is loading → show skeleton.
 * - Not signed in → redirect to /auth.
 * - Signed in but not admin → redirect to "/".
 */
const RequireAdmin = ({ children }: { children: ReactNode }) => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <PageLoadingSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default RequireAdmin;
