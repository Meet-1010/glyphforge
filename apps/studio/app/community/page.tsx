"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { SiteNav } from "../../components/site-nav"
import { LazyPreview } from "../../components/lazy-preview"
import { Button, CopyButton } from "../../components/ui"
import { encodeState } from "../../lib/config"
import {
  featuredCreations,
  isPortable,
  removeCreation,
  savedCreations,
  type Creation,
} from "../../lib/gallery"

const REPO = "https://github.com/Meet-1010/glyphforge"

export default function CommunityPage() {
  const [mine, setMine] = useState<Creation[]>([])
  const featured = featuredCreations()

  // localStorage is unavailable during prerender, so read it after mount.
  useEffect(() => setMine(savedCreations()), [])

  const drop = useCallback((id: string) => {
    removeCreation(id)
    setMine(savedCreations())
  }, [])

  return (
    <main className="min-h-dvh bg-ink">
      <SiteNav />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <header className="max-w-2xl">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-bone">
            Community
          </span>
          <h1 className="mt-4 text-2xl font-bold text-bone sm:text-3xl">
            Every preview here is running, not a screenshot.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-bone/55">
            A Glyphforge creation is a small piece of config, not a heavy asset — so a gallery entry
            can rebuild the real thing in your browser. Open any of them in the Studio and keep
            editing from exactly where its author left off.
          </p>
        </header>

        <section className="mt-12">
          <SectionHeading
            title="Featured"
            hint={`${featured.length} presets to start from`}
          />
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((creation) => (
              <CreationCard key={creation.id} creation={creation} />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <SectionHeading
            title="Your saves"
            hint={mine.length > 0 ? `${mine.length} saved in this browser` : undefined}
          />

          {mine.length === 0 ? (
            <div className="mt-5 rounded-[var(--radius-lg)] border border-dashed border-rule-bright p-10 text-center">
              <p className="font-mono text-[11px] text-bone/40">Nothing saved yet.</p>
              <p className="mx-auto mt-2 max-w-md font-mono text-[10px] leading-relaxed text-bone/25">
                Build something in the Studio and hit Save. Creations are stored in this browser
                only — they don&apos;t sync between devices, and clearing site data clears them.
              </p>
              <Link
                href="/studio"
                className="mt-5 inline-block rounded-[var(--radius-pill)] bg-bone px-4 py-2 font-mono text-[11px] text-ink transition-colors hover:bg-bone-dim"
              >
                Open the Studio
              </Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((creation) => (
                <CreationCard key={creation.id} creation={creation} onDelete={() => drop(creation.id)} />
              ))}
            </div>
          )}
        </section>

        <section className="mt-16 rounded-[var(--radius-lg)] border border-rule bg-ink-2 p-6">
          <h2 className="font-mono text-[12px] text-bone">Sharing what you make</h2>
          <div className="mt-3 space-y-3 text-[12px] leading-relaxed text-bone/50">
            <p>
              Being straight with you: there is no Glyphforge server, so this page can&apos;t accept
              uploads the way a hosted gallery would. Everything above is either shipped with the
              site or saved in your own browser.
            </p>
            <p>
              What does work today: every creation encodes into a link. Copy one and it travels
              anywhere — a message, a README, a tweet — and opens as the live, editable original.
              To get something onto the Featured row, send that link as an issue and it can be added
              to the site&apos;s data file.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`${REPO}/issues/new?title=${encodeURIComponent("Community submission")}&body=${encodeURIComponent(
                "Paste your Glyphforge share link here, plus the name you'd like credited.\n\nLink:\nCredit as:\n",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-pill)] bg-bone px-4 py-2 font-mono text-[11px] text-ink transition-colors hover:bg-bone-dim"
            >
              Submit a creation
            </a>
            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-pill)] border border-rule px-4 py-2 font-mono text-[11px] text-bone/60 transition-colors hover:border-rule-bright hover:text-bone"
            >
              Repository
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.22em] text-bone/50">{title}</h2>
      {hint && <span className="font-mono text-[10px] text-bone/25">{hint}</span>}
    </div>
  )
}

function CreationCard({ creation, onDelete }: { creation: Creation; onDelete?: () => void }) {
  const portable = isPortable(creation)
  const studioHref = portable ? `/studio?c=${encodeState(creation.config)}` : "/studio"
  const [origin, setOrigin] = useState("")

  useEffect(() => setOrigin(window.location.origin), [])

  return (
    <article className="rounded-[var(--radius-lg)] border border-rule bg-ink-2 p-1.5 transition-colors hover:border-rule-bright">
      <LazyPreview config={creation.config} height={200} className="overflow-hidden rounded-[var(--radius-md)]" />

      <div className="space-y-3 px-2.5 pb-2 pt-3.5">
        <div>
          <h3 className="truncate font-mono text-[12px] text-bone">{creation.title}</h3>
          <p className="mt-1 font-mono text-[10px] text-bone/35">
            {creation.author ?? "You"} · {sourceLabel(creation)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={studioHref}
            className="rounded-[var(--radius-pill)] bg-bone px-3.5 py-2 font-mono text-[11px] text-ink transition-colors hover:bg-bone-dim"
          >
            Open in Studio
          </Link>
          {portable && origin && (
            <CopyButton text={`${origin}${studioHref}`} label="Copy link" />
          )}
          {onDelete && (
            <Button variant="ghost" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>

        {!portable && (
          <p className="font-mono text-[10px] leading-relaxed text-bone-dim">
            Built from an uploaded file, so it can&apos;t be reopened or shared — that file only
            existed in the tab that made it.
          </p>
        )}
      </div>
    </article>
  )
}

function sourceLabel(creation: Creation): string {
  const model = creation.config.model
  switch (model.type) {
    case "text":
      return `text “${model.value}”`
    case "shape":
      return `${model.shape} shape`
    case "image":
      return `image · ${model.mode ?? "relief"}`
    case "svg":
      return "svg"
    case "url":
      return "glb model"
    default:
      return "model"
  }
}
