import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { LoginForm } from "@/components/app/login-form";

export default async function LoginPage() {
  // Forward only genuinely valid sessions; stale cookies land on the form
  // (never a redirect loop — the proxy does not bounce here).
  const user = await getCurrentUser();
  if (user) redirect("/team-command");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="fade-up w-full max-w-md rounded-[10px] border border-edge bg-panel p-6 shadow-[0_30px_80px_-40px_rgba(34,211,238,0.25)]">
        <div className="mb-6">
          <span className="display-heading text-2xl">
            <span className="text-accent">Sportmetryx</span> Football
          </span>
          <p className="mt-1 text-xs text-muted">Sign in to Team Command (demo environment).</p>
        </div>
        <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
