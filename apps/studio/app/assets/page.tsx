"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { SiteNav } from "../../components/site-nav"
import { Button } from "../../components/ui"
import { DEFAULT_STATE, encodeState } from "../../lib/config"
import {
  PROVIDERS,
  searchAssets,
  type AssetResult,
  type ProviderId,
  type SearchOutcome,
} from "../../lib/providers"

const SUGGESTIONS = ["chair", "plant", "helmet", "lamp", "rock", "bottle", "statue", "car"]

export default function AssetsPage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [providers, setProviders] = useState<ProviderId[]>(["polyhaven", "khronos"])
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  // Catalogues are fetched once and filtered locally, so debouncing only needs
  // to cover the typing burst, not network latency.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      searchAssets({ query, providers })
        .then((next) => {
          if (!cancelled) setOutcome(next)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 180)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, providers])

  const toggleProvider = (id: ProviderId) => {
    setProviders((current) =>
      current.includes(id)
        ? current.length > 1
          ? current.filter((p) => p !== id)
          : current
        : [...current, id],
    )
  }

  /** Resolve the real file URL, then hand it to the Studio as a shared config. */
  const importAsset = useCallback(
    async (asset: AssetResult) => {
      setImporting(asset.id)
      setImportError(null)
      try {
        const src = await asset.resolveModelUrl()
        const config = encodeState({
          ...DEFAULT_STATE,
          model: { type: "url", src },
          // A downloaded asset arrives with its own materials and its own
          // scale; auto-framing handles the latter.
          cameraZ: "auto",
        })
        router.push(`/studio?c=${config}`)
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : `Could not import "${asset.name}"`,
        )
        setImporting(null)
      }
    },
    [router],
  )

  const results = outcome?.results ?? []

  const heading = useMemo(() => {
    if (loading && !outcome) return "Loading catalogues…"
    if (!outcome) return ""
    if (outcome.total === 0) return "No models matched"
    const shown = Math.min(outcome.total, results.length)
    return `${outcome.total} model${outcome.total === 1 ? "" : "s"}${
      outcome.total > shown ? ` · showing ${shown}` : ""
    }`
  }, [loading, outcome, results.length])

  return (
    <main className="min-h-dvh bg-ink">
      <SiteNav />

      <div className="mx-auto max-w-6xl px-5 py-10">
        <header className="max-w-2xl">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-violet">
            Asset search
          </span>
          <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">
            Find a model, send it straight to the Studio.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/55">
            Searches open 3D catalogues directly from your browser. Nothing is proxied through a
            server, so no one — including us — sees what you look for.
          </p>
        </header>

        <div className="mt-8 space-y-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search models — chair, helmet, plant…"
            className="w-full rounded-lg border border-edge bg-ink-raised px-4 py-3 font-mono text-[13px] text-white outline-none transition-colors placeholder:text-white/25 focus:border-violet"
          />

          <div className="flex flex-wrap items-center gap-2">
            {PROVIDERS.map((provider) => {
              const active = providers.includes(provider.id)
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => toggleProvider(provider.id)}
                  title={`${provider.blurb} · ${provider.license}`}
                  className={`rounded-md border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                    active
                      ? "border-violet bg-violet/10 text-violet"
                      : "border-edge text-white/40 hover:border-edge-bright hover:text-white/70"
                  }`}
                >
                  {provider.label}
                </button>
              )
            })}
            <span className="ml-auto font-mono text-[10px] text-white/30">{heading}</span>
          </div>

          {!query && (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="font-mono text-[10px] text-white/25">Try:</span>
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="rounded-md px-2 py-1 font-mono text-[10px] text-white/40 transition-colors hover:bg-white/5 hover:text-white/75"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>

        {outcome?.failed.map((failure) => (
          <p
            key={failure.provider}
            className="mt-4 rounded-md border border-amber/25 bg-amber/5 px-3 py-2 font-mono text-[10px] text-amber/80"
          >
            {PROVIDERS.find((p) => p.id === failure.provider)?.label} is unreachable:{" "}
            {failure.message}
          </p>
        ))}

        {importError && (
          <p className="mt-4 rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2 font-mono text-[10px] text-red-300/80">
            {importError}
          </p>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          <p className="mt-16 text-center font-mono text-[11px] text-white/30">
            Nothing matched “{query}”. Try a broader word, or forge one from scratch in the{" "}
            <a href="/studio" className="text-violet hover:text-white">
              Studio
            </a>
            .
          </p>
        )}

        <footer className="mt-16 border-t border-edge pt-6">
          <p className="font-mono text-[10px] leading-relaxed text-white/30">
            Licences are shown exactly as the source states them and are never guessed. Poly Haven
            models are CC0; Khronos sample models vary per model, so check the source before using
            one commercially.
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
  const [broken, setBroken] = useState(false)

  return (
    <article className="group overflow-hidden rounded-xl border border-edge bg-ink-raised transition-colors hover:border-edge-bright">
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-panel">
        {asset.thumbnail && !broken ? (
          // Remote thumbnails from many hosts; next/image would need each one
          // whitelisted in next.config for no real benefit here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={asset.thumbnail}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center font-mono text-[10px] text-white/20">
            no preview
          </div>
        )}
        <span className="absolute left-2 top-2 rounded bg-ink/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/60 backdrop-blur-sm">
          {asset.provider === "polyhaven" ? "Poly Haven" : "Khronos"}
        </span>
      </div>

      <div className="space-y-2.5 p-3.5">
        <div>
          <h3 className="truncate font-mono text-[12px] text-white" title={asset.name}>
            {asset.name}
          </h3>
          <p className="mt-1 truncate font-mono text-[10px] text-white/35">
            {asset.author ? `${asset.author} · ` : ""}
            {asset.license}
            {asset.polycount ? ` · ${asset.polycount.toLocaleString()} tris` : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={onImport} disabled={disabled}>
            {importing ? "Importing…" : "Import to Studio"}
          </Button>
          <a
            href={asset.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-2 py-2 font-mono text-[10px] text-white/35 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            Source
          </a>
        </div>
      </div>
    </article>
  )
}
