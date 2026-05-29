import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";
import { CenteredMessage } from "./CenteredMessage.tsx";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, status, loading } = useAuth();

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  if (status !== "approved") {
    return <Navigate to="/pending" replace />;
  }

  return <>{children}</>;
}
