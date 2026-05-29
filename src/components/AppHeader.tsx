import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export function AppHeader() {
  const { user, isSuperAdmin, signOut } = useAuth();

  return (
    <header className="border-b border-slate-800 bg-slate-900/60">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-bold tracking-tight text-sky-400">QRS</span>
          <span className="hidden text-sm text-slate-400 sm:inline">
            Qualifying Run Sequence
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {isSuperAdmin && (
            <Link
              to="/admin"
              className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300 hover:bg-sky-500/25"
            >
              Admin
            </Link>
          )}
          <span className="hidden text-slate-400 sm:inline">{user?.email}</span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-200 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
