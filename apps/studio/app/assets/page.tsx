"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SiteNav } from "../../components/site-nav"
import { Button } from "../../components/ui"
import { DEFAULT_STATE, encodeState } from "../../lib/config"
import {
  PROVIDERS,
  TOTAL_ASSETS,
  fetchSketchfabMetadata,
  searchAssets,
  type AssetResult,
  type ProviderId,
  type SearchOutcome,
} from "../../lib/providers"

const SUGGESTIONS = ["chair", "helmet", "plant", "car", "sword", "lamp", "dog", "guitar"]
const ALL_PROVIDERS = PROVIDERS.map((p) => p.id)

export default function AssetsPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [providers, setProviders] = useState<ProviderId[]>(ALL_PROVIDERS)
  const [animatedOnly, setAnimatedOnly] = useState(false)
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchAssets({ query, providers, animatedOnly })
        .then((next) => {
          if (!cancelled) setOutcome(next)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 200)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, providers, animatedOnly])

  const toggleProvider = (id: ProviderId) => {
    setProviders((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((p) => p !== id)
          : current
        : [...current, id],
    )
  }

  const importAsset = useCallback(
    async (asset: AssetResult) => {
      setImporting(asset.id)
      setImportError(null)
      try {
        const src = await asset.resolveModelUrl()
        const config = encodeState({
          ...DEFAULT_STATE,
          model: { type: "url", src },
          cameraZ: "auto",
        })
        router.push(`/studio?c=${config}`)
      } catch (error) {
        setImportError(error instanceof Error ? error.message : `Could not import "${asset.name}"`)
        setImporting(null)
      }
    },
    [router],
  )

  const results = outcome?.results ?? []

  return (
    <main className="min-h-dvh bg-ink">
      <SiteNav />

      {/* Sticky so the filters stay reachable deep in a long grid. */}
      <div className="sticky top-[49px] z-20 border-b border-rule bg-ink/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`Search ${TOTAL_ASSETS.toLocaleString()} importable models…`}
                className="w-full rounded-[var(--radius-pill)] border border-rule bg-ink-2 px-5 py-3 pr-20 font-mono text-[13px] text-bone outline-none transition-colors placeholder:text-bone/25 focus:border-bone"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] text-bone/25">
                {loading ? "…" : outcome ? outcome.total.toLocaleString() : ""}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setAnimatedOnly((value) => !value)}
              className={`shrink-0 rounded-[var(--radius-pill)] border px-4 py-3 font-mono text-[11px] transition-colors ${
                animatedOnly
                  ? "border-bone bg-bone/10 text-bone"
                  : "border-rule text-bone/45 hover:border-rule-bright hover:text-bone/75"
              }`}
            >
              Animated only
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {PROVIDERS.map((provider) => {
              const active = providers.includes(provider.id)
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => toggleProvider(provider.id)}
                  title={`${provider.blurb}\n${provider.license}`}
                  className={`rounded-[var(--radius-pill)] border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    active
                      ? "border-bone/50 bg-bone/10 text-bone"
                      : "border-rule text-bone/35 hover:border-rule-bright hover:text-bone/60"
                  }`}
                >
                  {provider.label}
                  <span className="ml-1.5 opacity-50">{provider.size}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-8">
        {!query && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] text-bone/25">Try:</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setQuery(suggestion)}
                className="rounded-[var(--radius-pill)] border border-rule px-2.5 py-1 font-mono text-[10px] text-bone/40 transition-colors hover:border-bone hover:text-bone"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {animatedOnly && (
          <p className="mb-4 border border-rule bg-ink-2 px-3 py-2 font-mono text-[10px] leading-relaxed text-bone/40">
            Showing only models their catalogue reports as animated. Objaverse publishes no
            animation flag, so its 46,207 models are excluded from this filter rather than guessed
            at — clear it to browse them.
          </p>
        )}

        {outcome?.failed.map((failure) => (
          <p
            key={failure.provider}
            className="mb-4 rounded-[var(--radius-md)] border border-rule-bright bg-ink-3 px-3 py-2 font-mono text-[10px] text-bone-dim"
          >
            {PROVIDERS.find((p) => p.id === failure.provider)?.label} is unreachable:{" "}
            {failure.message}
          </p>
        ))}

        {importError && (
          <p className="mb-4 rounded-[var(--radius-md)] border border-red-500/25 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-300/80">
            {importError}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((asset) => (
            <AssetCard
              key={`${asset.provider}:${asset.id}`}
              asset={asset}
              importing={importing === asset.id}
              disabled={importing !== null}
              onImport={() => importAsset(asset)}
            />
          ))}
        </div>

        {!loading && outcome && outcome.total === 0 && (
          <p className="mt-20 text-center font-mono text-[11px] text-bone/30">
            Nothing matched “{query}”. Try a broader word, or forge one from scratch in the{" "}
            <a href="/studio" className="text-bone hover:text-bone">
              Studio
            </a>
            .
          </p>
        )}

        <footer className="mt-16 border-t border-rule pt-6">
          <p className="max-w-3xl font-mono text-[10px] leading-relaxed text-bone/30">
            Licences are printed exactly as each source states them and are never inferred. Poly
            Haven is CC0; Objaverse models are individually licensed on Sketchfab, mostly CC-BY;
            Khronos and three.js vary per model. Check the source before using anything
            commercially. Sketchfab results are searchable but not directly importable — downloading
            there needs your own account, so open the source, download, then upload in the Studio.
          </p>
        </footer>
      </div>
    </main>
  )
}

function AssetCard({
  asset,
  importing,
  disabled,
  onImport,
}: {
  asset: AssetResult
  importing: boolean
  disabled: boolean
  onImport: () => void
}) {
  const ref = useRef<HTMLElement>(null)
  const [broken, setBroken] = useState(false)
  const [extra, setExtra] = useState<Partial<AssetResult> | null>(null)

  // Objaverse knows only a category up front. Fetching each model's real name,
  // author, licence and thumbnail on demand — and only once the card is on
  // screen — keeps a 46k-row catalogue from fanning out into thousands of
  // requests the moment you type.
  useEffect(() => {
    if (!asset.enrich || extra) return
    const element = ref.current
    if (!element || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()
        void fetchSketchfabMetadata(asset.id).then((data) => data && setExtra(data))
      },
      { rootMargin: "200px" },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [asset.enrich, asset.id, extra])

  const merged = { ...asset, ...(extra ?? {}) }
  const provider = PROVIDERS.find((p) => p.id === asset.provider)

  return (
    <article
      ref={ref}
      className="group flex flex-col rounded-[var(--radius-lg)] border border-rule bg-ink-2 p-1.5 transition-colors hover:border-rule-bright"
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--radius-md)] bg-ink-3">
        {merged.thumbnail && !broken ? (
          // Thumbnails come from several hosts; next/image would need each one
          // allow-listed in next.config for no real benefit here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={merged.thumbnail}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full place-items-center font-mono text-[10px] text-bone/15">
            {asset.enrich && !extra ? "···" : "no preview"}
          </div>
        )}

        <span className="absolute left-2 top-2 rounded-[var(--radius-pill)] bg-ink/85 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-bone/60 backdrop-blur-sm">
          {provider?.label}
        </span>

        {merged.animated && (
          <span className="absolute right-2 top-2 rounded-[var(--radius-pill)] bg-bone/90 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-ink">
            Animated
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2 pt-3">
        <div className="flex-1">
          <h3 className="truncate font-mono text-[12px] text-bone" title={merged.name}>
            {merged.name}
          </h3>
          <p className="mt-1 truncate font-mono text-[10px] text-bone/35">
            {merged.author ? `${merged.author} · ` : ""}
            {merged.license}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {asset.importable ? (
            <>
              <Button variant="primary" onClick={onImport} disabled={disabled}>
                {importing ? "Importing…" : "Import"}
              </Button>
              <a
                href={merged.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="View licence and original"
                className="rounded-[var(--radius-pill)] px-2.5 py-2 font-mono text-[10px] text-bone/30 transition-colors hover:bg-bone/5 hover:text-bone/70"
              >
                Source
              </a>
            </>
          ) : (
            <a
              href={asset.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[var(--radius-pill)] border border-rule px-3.5 py-2 font-mono text-[11px] text-bone/60 transition-colors hover:border-rule-bright hover:text-bone"
            >
              Open on Sketchfab
            </a>
          )}
        </div>
      </div>
    </article>
  )
}
