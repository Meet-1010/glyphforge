"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/setup", label: "Setup" },
  { href: "/assets", label: "Assets" },
  { href: "/community", label: "Community" },
  { href: "/studio", label: "Studio" },
]

export function SiteNav({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      className={`${
        floating ? "fixed inset-x-0 top-0 z-30 bg-ink/80 backdrop-blur-md" : "sticky top-0 z-30 bg-ink"
      } flex items-center justify-between gap-3 border-b border-rule px-4 py-3.5 sm:gap-4 sm:px-5`}
    >
      <Link href="/" className="group flex items-baseline gap-1.5">
        {/* A bracket rather than a coloured second syllable: the wordmark should
            read as a prompt, and the page has no accent colour to spend. */}
        <span className="font-mono text-[13px] tracking-tight text-bone">glyphforge</span>
        <span className="font-mono text-[13px] text-muted transition-colors group-hover:text-bone">
          ▮
        </span>
      </Link>

      <div className="flex min-w-0 items-center gap-1 sm:gap-5">
        {LINKS.map((link) => {
          const active = pathname === link.href
          const primary = link.href === "/studio"

          if (primary) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="shrink-0 rounded-[var(--radius-pill)] bg-bone px-3 py-1.5 font-mono text-[11px] text-ink transition-colors hover:bg-bone-dim sm:px-4"
              >
                {link.label}
              </Link>
            )
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-1.5 font-mono text-[11px] transition-colors sm:px-3 ${
                active
                  ? "bg-ink-3 text-bone"
                  : "text-muted hover:bg-ink-2 hover:text-bone"
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
