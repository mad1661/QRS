import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth.tsx";

export function SignIn() {
  const { user, status, loading, signInWithGoogle, signInWithEmail, registerWithEmail } =
    useAuth();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) {
    return <Navigate to={status === "approved" ? "/" : "/pending"} replace />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold tracking-tight text-sky-400">QRS</div>
          <p className="mt-1 text-sm text-slate-400">Qualifying Run Sequence</p>
        </div>

        <button
          type="button"
          onClick={onGoogle}
          disabled={busy}
          className="mb-4 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-slate-700 disabled:opacity-50"
        >
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" />
          or
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "register" : "signin")}
          className="mt-5 w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === "signin"
            ? "Need an account? Register"
            : "Have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
