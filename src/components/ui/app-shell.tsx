import Link from "next/link";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { isGuest, GUEST_USER } from "@/lib/offline";
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
  {
    section: "Commerce",
    items: [
      { href: "/marketplace", label: "Marketplace" },
    ],
  },
];

export async function AppShell({
  children,
  crumb,
  title,
}: {
  children: ReactNode;
  crumb: string;
  title: string;
}) {
  const guest = await isGuest();
  const cartItems = await getCartState();
  return (
    <div className="flex min-h-dvh">
      <Sidebar guest={guest} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header crumb={crumb} guest={guest} cartItems={cartItems} />
        {guest ? (
          <div className="border-b border-purple-500/30 bg-prototype/15 px-4 py-2 text-center text-xs font-semibold text-purple-300 md:px-8" role="note">
            Guest demo mode — showing SYNTHETIC SAMPLE data. No account or live database required.
            Write actions (exports, interventions, consent) are disabled.
          </div>
        ) : null}
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

async function Sidebar({ guest }: { guest?: boolean }) {
  const user = guest ? GUEST_USER : await getCurrentUser();
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

function Header({ crumb, guest, cartItems }: { crumb: string; guest?: boolean; cartItems?: { productId: string; quantity: number }[] }) {
  const totalItems = (cartItems ?? []).reduce((a, i) => a + i.quantity, 0);
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-panel/90 px-4 py-2 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" className="display-heading text-lg md:hidden">
          <span className="text-accent">Sportmetryx</span>
        </Link>
        <span className="hidden font-mono text-xs text-muted md:block">{crumb}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center rounded-full border border-prototype/40 bg-prototype/15 px-3 py-1 text-xs font-semibold text-purple-300">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-purple-400" aria-hidden="true" />
          {guest ? "Guest · synthetic sample" : "Synthetic demo · PROTOTYPE"}
        </span>
        <CartIcon totalItems={totalItems} />
      </div>
    </header>
  );
}

function CartIcon({ totalItems }: { totalItems: number }) {
  return (
    <Link
      href="/marketplace/cart"
      className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-panel-2 px-2 py-1.5 text-xs font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
      aria-label={`Open cart, ${totalItems} item${totalItems === 1 ? "" : "s"}`}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
        <path d="M2 12.5H11M5 12.5V8.5L6.5 6l2 2.5V12.5M10 12.5V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12.5" cy="2" r="1.3" fill="currentColor" />
      </svg>
      {totalItems > 0 ? <span className="tabular">{totalItems}</span> : null}
    </Link>
  );
}

async function getCartState(): Promise<{ productId: string; quantity: number }[]> {
  try {
    const res = await fetch("/api/marketplace/cart-state", { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { items?: { productId: string; quantity: number }[] };
    return Array.isArray(body.items) ? body.items : [];
  } catch {
    return [];
  }
}
