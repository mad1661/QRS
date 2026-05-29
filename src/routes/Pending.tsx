import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export function Pending() {
  const { user, status, loading, signOut } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (status === "approved") return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div className="max-w-md rounded-2xl border border-slate-800 bg-slate-900/60 p-8">
        <h1 className="text-xl font-semibold text-slate-100">
          {status === "denied" ? "Access denied" : "Awaiting approval"}
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          {status === "denied"
            ? "Your account request was not approved. Contact an administrator."
            : "Your account is pending approval. An administrator will review it shortly."}
        </p>
        <p className="mt-2 text-xs text-slate-500">Signed in as {user.email}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm text-slate-200 hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
