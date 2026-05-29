import type { ReactNode } from "react";

export function CenteredMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6 text-center text-slate-300">
      <div>{children}</div>
    </div>
  );
}
