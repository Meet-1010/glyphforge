"use client"

import { useEffect, useState, type ReactNode } from "react"

export function Panel({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-b border-edge last:border-b-0">
      <header className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/40">{title}</h2>
        {action}
      </header>
      <div className="space-y-3 px-4 pb-4">{children}</div>
    </section>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-white/55">{label}</span>
        {hint && <span className="font-mono text-[10px] tabular-nums text-white/30">{hint}</span>}
      </div>
      {children}
    </label>
  )
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 0.01,
  label,
  format,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  step?: number
  label: string
  format?: (value: number) => string
}) {
  return (
    <Field label={label} hint={format ? format(value) : String(Math.round(value * 100) / 100)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </Field>
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors hover:bg-white/[0.03]"
    >
      <span className="font-mono text-[11px] text-white/55">{label}</span>
      <span
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${
          checked ? "bg-violet" : "bg-edge-bright"
        }`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-ink transition-transform ${
            checked ? "translate-x-3.5" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label?: string
}) {
  return (
    <div>
      {label && (
        <div className="mb-1.5 font-mono text-[11px] text-white/55">{label}</div>
      )}
      <div className="flex gap-1 rounded-lg border border-edge bg-ink p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-md px-2 py-1.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              value === option.value
                ? "bg-violet text-ink"
                : "text-white/45 hover:bg-white/5 hover:text-white/70"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <Field label={label}>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="w-full appearance-none rounded-md border border-edge bg-ink px-3 py-2 font-mono text-[11px] text-white/80 outline-none transition-colors focus:border-violet"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-ink">
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export function TextInput({
  value,
  onChange,
  label,
  placeholder,
  multiline,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  multiline?: boolean
}) {
  const className =
    "w-full rounded-md border border-edge bg-ink px-3 py-2 font-mono text-[12px] text-white/85 outline-none transition-colors placeholder:text-white/25 focus:border-violet"
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          value={value}
          rows={2}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${className} resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={className}
        />
      )}
    </Field>
  )
}

export function ColorField({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (value: string) => void
  label: string
}) {
  return (
    <Field label={label} hint={value.toUpperCase()}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 shrink-0 rounded-md"
        />
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-edge bg-ink px-3 py-1.5 font-mono text-[11px] text-white/70 outline-none focus:border-violet"
        />
      </div>
    </Field>
  )
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  title,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: "default" | "primary" | "ghost"
  disabled?: boolean
  title?: string
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 font-mono text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-40"
  const variants = {
    default: "border border-edge bg-ink-raised text-white/75 hover:border-edge-bright hover:text-white",
    primary: "bg-violet text-ink hover:bg-violet-dim",
    ghost: "text-white/45 hover:bg-white/5 hover:text-white/80",
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>
      {children}
    </button>
  )
}

/** Button that briefly confirms it copied, so the click has visible feedback. */
export function CopyButton({
  text,
  label = "Copy",
  variant = "default",
}: {
  text: string
  label?: string
  variant?: "default" | "primary" | "ghost"
}) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1600)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <Button
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
        } catch {
          // Clipboard can be blocked (insecure origin, denied permission).
          // Selecting the code block by hand still works, so fail quietly.
        }
      }}
    >
      {copied ? "Copied" : label}
    </Button>
  )
}
