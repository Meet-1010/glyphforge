"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const LINKS = [
  { href: "/assets", label: "Assets" },
  { href: "/community", label: "Community" },
  { href: "/studio", label: "Studio" },
]

export function SiteNav({ floating = false }: { floating?: boolean }) {
  const pathname = usePathname()

  return (
    <nav
      className={`${
        floating ? "fixed inset-x-0 top-0 z-30 bg-ink/70 backdrop-blur-md" : "sticky top-0 z-30 bg-ink"
      } flex items-center justify-between gap-4 border-b border-edge px-5 py-3`}
    >
      <Link href="/" className="font-mono text-[13px] font-bold tracking-tight text-white">
        glyph<span className="text-violet">forge</span>
      </Link>

      <div className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          const primary = link.href === "/studio"
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors ${
                primary
                  ? "bg-violet text-ink hover:bg-violet-dim"
                  : active
                    ? "text-white"
                    : "text-white/45 hover:text-white"
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
