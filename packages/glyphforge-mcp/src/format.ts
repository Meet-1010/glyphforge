/**
 * Response shaping shared by every tool.
 *
 * Each tool returns the same envelope: a text block in the requested format
 * plus `structuredContent`, so a client that understands structured output can
 * read fields directly instead of parsing prose back out of markdown.
 */

import { z } from "zod"
import { CHARACTER_LIMIT } from "./constants.js"

export const ResponseFormat = z
  .enum(["markdown", "json"])
  .default("markdown")
  .describe("Output format: 'markdown' for human-readable, 'json' for machine-readable")

export type ToolResult = {
  content: Array<{ type: "text"; text: string }>
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

/** Build the standard success envelope, truncating the text if it runs long. */
export function reply(
  markdown: string,
  structured: Record<string, unknown>,
  format: "markdown" | "json",
): ToolResult {
  const text = format === "json" ? JSON.stringify(structured, null, 2) : markdown
  return {
    content: [{ type: "text", text: truncate(text) }],
    structuredContent: structured,
  }
}

export function truncate(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text
  const keep = text.slice(0, CHARACTER_LIMIT - 240)
  return `${keep}\n\n---\n\n_Response truncated at ${CHARACTER_LIMIT} characters. Narrow the request — raise \`offset\`, lower \`limit\`, or ask for one \`topic\` at a time._`
}

/**
 * Errors an agent can act on.
 *
 * Every message says what failed and what to try instead, because a tool error
 * that only says "request failed" costs the agent a turn guessing.
 */
export function fail(message: string, suggestion?: string): ToolResult {
  return {
    isError: true,
    content: [
      { type: "text", text: suggestion ? `Error: ${message} ${suggestion}` : `Error: ${message}` },
    ],
  }
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "the request timed out"
    return error.message
  }
  return String(error)
}

/** `fetch` with a timeout, since a hung catalogue would otherwise stall the agent. */
export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`${url} returned ${response.status}`)
    return (await response.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Markdown table from a list of [label, value] pairs, skipping empty values. */
export function definitionList(rows: Array<[string, string | number | undefined | null]>): string {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `- **${label}**: ${value}`)
    .join("\n")
}

export function codeBlock(code: string, lang = "tsx"): string {
  return `\`\`\`${lang}\n${code.trimEnd()}\n\`\`\``
}
