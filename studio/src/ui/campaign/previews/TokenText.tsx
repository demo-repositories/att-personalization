// studio/src/ui/campaign/previews/TokenText.tsx
//
// <TokenText> — render text containing {{token}} placeholders with a raw/merged
// toggle controlled by the parent. Raw mode shows each token as a colored chip
// (sanity vs external vs unresolved) using tokenChipMeta. Merged mode shows the
// resolved string (resolveTokens) — async, so we cache the resolved value.
//
// App-SDK-compatible: takes `client` as a prop, imports nothing from sanity.

import {Badge, Box, Inline, Text} from '@sanity/ui'
import {useEffect, useState} from 'react'
import type {SanityClient} from '@sanity/client'
import {
  extractTokens,
  resolveTokens,
  tokenChipMeta,
  type MergeField,
  type MinimalBrief,
} from '../../../personalization/generate/tokens'

export type TokenMode = 'raw' | 'merged'

export interface TokenTextProps {
  text?: string
  mode: TokenMode
  brief: MinimalBrief
  mergeFields: MergeField[]
  client: SanityClient
  /** Override the rendered Text size (default 1). */
  size?: 0 | 1 | 2 | 3 | 4
  /** When true, render with muted color. */
  muted?: boolean
  /** Wrap rendered output in a block-level container instead of inline. */
  block?: boolean
}

// Hex colors are intentional here (chip backgrounds for the demo).
// PRD Appendix D allows brand hex inside brand mocks; chip colors are a
// distinct UI signal (sanity = blue, external = amber, unresolved = red).
const CHIP_BG: Record<'sanity' | 'external' | 'unresolved', string> = {
  sanity: '#dbeafe',
  external: '#fef3c7',
  unresolved: '#fee2e2',
}
const CHIP_FG: Record<'sanity' | 'external' | 'unresolved', string> = {
  sanity: '#1e3a8a',
  external: '#92400e',
  unresolved: '#991b1b',
}

function RawChips({
  text,
  brief,
  mergeFields,
  size,
  muted,
}: {
  text: string
  brief: MinimalBrief
  mergeFields: MergeField[]
  size: 0 | 1 | 2 | 3 | 4
  muted: boolean
}) {
  // Split the text into [plain, chip, plain, chip, ...] segments.
  const segments: Array<{type: 'plain'; value: string} | {type: 'chip'; key: string; raw: string}> = []
  let lastIndex = 0
  const re = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) {
      segments.push({type: 'plain', value: text.slice(lastIndex, m.index)})
    }
    segments.push({type: 'chip', key: m[1]!, raw: m[0]})
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) {
    segments.push({type: 'plain', value: text.slice(lastIndex)})
  }

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'plain') {
          return (
            <Text key={i} size={size} muted={muted} as="span" style={{whiteSpace: 'pre-wrap'}}>
              {seg.value}
            </Text>
          )
        }
        const meta = tokenChipMeta(seg.key, mergeFields, brief)
        const bg = CHIP_BG[meta.source]
        const fg = CHIP_FG[meta.source]
        return (
          <span
            key={i}
            title={meta.resolverHint ? `${meta.source} — ${meta.resolverHint}` : meta.source}
            style={{
              background: bg,
              color: fg,
              borderRadius: 4,
              padding: '0 4px',
              margin: '0 1px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}
          >
            <Text size={size} style={{color: 'inherit', fontFamily: 'inherit'}} as="span">
              {seg.raw}
            </Text>
          </span>
        )
      })}
    </>
  )
}

export function TokenText({
  text,
  mode,
  brief,
  mergeFields,
  client,
  size = 1,
  muted = false,
  block = false,
}: TokenTextProps) {
  const [resolved, setResolved] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  // Resolve when we switch to merged (or the text changes while in merged).
  useEffect(() => {
    if (mode !== 'merged' || !text) {
      setResolved(null)
      return
    }
    // Skip the round trip if there are no tokens.
    if (extractTokens(text).length === 0) {
      setResolved(text)
      return
    }
    let cancelled = false
    setResolving(true)
    resolveTokens(text, {brief, mergeFields, client, sampleMode: true})
      .then((r) => {
        if (!cancelled) setResolved(r)
      })
      .catch(() => {
        if (!cancelled) setResolved(text)
      })
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => {
      cancelled = true
    }
  }, [mode, text, brief, mergeFields, client])

  if (!text) {
    return (
      <Text size={size} muted>
        —
      </Text>
    )
  }

  const Wrap = block ? Box : Inline

  if (mode === 'merged') {
    if (resolving && resolved == null) {
      return (
        <Text size={size} muted>
          Resolving tokens…
        </Text>
      )
    }
    return (
      <Wrap>
        <Text size={size} muted={muted} style={{whiteSpace: 'pre-wrap'}}>
          {resolved ?? text}
        </Text>
      </Wrap>
    )
  }

  return (
    <Wrap>
      <RawChips text={text} brief={brief} mergeFields={mergeFields} size={size} muted={muted} />
    </Wrap>
  )
}

/** Optional helper for callers that want a small legend below the toggle. */
export function TokenLegend() {
  return (
    <Inline space={2}>
      <Badge tone="primary" mode="outline">Sanity</Badge>
      <Badge tone="caution" mode="outline">External</Badge>
      <Badge tone="critical" mode="outline">Unresolved</Badge>
    </Inline>
  )
}
