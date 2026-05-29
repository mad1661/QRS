import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.tsx";
import { useAuth } from "../lib/auth.tsx";
import { setUserStatus, subscribeUsers } from "../lib/store.ts";
import type { AccountStatus } from "../lib/constants.ts";
import type { UserDoc } from "../lib/types.ts";

const STATUS_STYLES: Record<AccountStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-300",
  denied: "bg-red-500/15 text-red-300",
};

export function Admin() {
  const { isSuperAdmin, loading } = useAuth();
  const [users, setUsers] = useState<UserDoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    const unsub = subscribeUsers(setUsers, (err) => setError(err.message));
    return unsub;
  }, [isSuperAdmin]);

  const sorted = useMemo(() => {
    const rank: Record<AccountStatus, number> = {
      pending: 0,
      approved: 1,
      denied: 2,
    };
    return [...users].sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.email ?? "").localeCompare(b.email ?? ""),
    );
  }, [users]);

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  async function update(uid: string, status: AccountStatus) {
    try {
      await setUserStatus(uid, status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  const pendingCount = users.filter((u) => u.status === "pending").length;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-1 text-xl font-semibold text-slate-100">
          Account approvals
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          {pendingCount} pending · {users.length} total
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-900 bg-red-950/50 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {users.length === 0 ? (
          <p className="text-sm text-slate-400">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-800 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            {sorted.map((u) => (
              <li
                key={u.uid}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">
                    {u.email ?? "(no email)"}
                  </p>
                  {u.displayName && (
                    <p className="truncate text-xs text-slate-500">
                      {u.displayName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[u.status]}`}
                  >
                    {u.status}
                  </span>
                  {u.status !== "approved" && (
                    <button
                      type="button"
                      onClick={() => update(u.uid, "approved")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    >
                      Approve
                    </button>
                  )}
                  {u.status !== "denied" && (
                    <button
                      type="button"
                      onClick={() => update(u.uid, "denied")}
                      className="rounded-md px-3 py-1.5 text-xs text-red-400 hover:bg-red-950/60 hover:text-red-300"
                    >
                      Deny
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
