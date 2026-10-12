import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { SignOutButton } from "@/components/ui/sign-out";

const NAV: { section: string; items: { href: string; label: string }[] }[] = [
  {
    section: "Command",
    items: [
      { href: "/team-command", label: "Team Command" },
      { href: "/interventions", label: "Intervention Queue" },
      { href: "/roster", label: "Roster" },
    ],
  },
  {
    section: "Intelligence",
    items: [
      { href: "/position-room", label: "Position Room" },
      { href: "/practice-command", label: "Practice Command" },
      { href: "/game-readiness", label: "Game Readiness" },
      { href: "/recovery-command", label: "Recovery Command" },
      { href: "/environment-travel", label: "Environment & Travel" },
    ],
  },
  {
    section: "Governance",
    items: [
      { href: "/data-quality", label: "Data Quality & Validity" },
      { href: "/research", label: "Research & Exports" },
      { href: "/admin", label: "Administration & Audit" },
    ],
  },
];

export function AppShell({
  children,
  crumb,
  title,
}: {
  children: ReactNode;
  crumb: string;
  title: string;
}) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header crumb={crumb} />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8">
          <h1 className="display-heading mb-1 text-3xl md:text-4xl">{title}</h1>
          {children}
        </main>
        <footer className="border-t border-edge px-4 py-3 text-center text-xs text-muted md:px-8">
          Decision support only. Not a medical device. Prototype models are for research and
          demonstration. © Sportmetryx. All athlete data governed by consent and access controls.
        </footer>
      </div>
    </div>
  );
}

async function Sidebar() {
  const user = await getCurrentUser();
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-edge bg-panel-2 px-3 py-4 md:flex">
      <Link href="/" className="mb-6 block px-2">
        <span className="display-heading text-xl">
          <span className="text-accent">Sportmetryx</span> Football
        </span>
        <span className="block text-[10px] uppercase tracking-widest text-muted">
          <span className="live-dot mr-1.5" aria-hidden="true" />
          Powered by Healthmetryx
        </span>
      </Link>
      <nav aria-label="Application" className="flex flex-1 flex-col gap-4">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
              {group.section}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-md border-l-2 border-transparent px-2 py-1.5 text-sm text-ink/90 transition-all hover:translate-x-1 hover:border-accent hover:bg-panel hover:text-accent"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {user ? (
        <div className="border-t border-edge px-2 pt-3 text-xs">
          <div className="truncate text-muted" title={user.email ?? ""}>
            {user.name ?? user.email}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="rounded-full border border-edge px-2 py-0.5 text-[10px] uppercase tracking-wider text-accent">
              {user.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Header({ crumb }: { crumb: string }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-panel/90 px-4 py-2 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="display-heading text-lg md:hidden">
          <span className="text-accent">Sportmetryx</span>
        </Link>
        <span className="hidden font-mono text-xs text-muted md:block">{crumb}</span>
      </div>
      <span className="inline-flex items-center rounded-full border border-prototype/40 bg-prototype/15 px-3 py-1 text-xs font-semibold text-purple-300">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-purple-400" aria-hidden="true" />
        Synthetic demo · PROTOTYPE
      </span>
    </header>
  );
}
