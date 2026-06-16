// studio/src/ui/campaign/previews/TokenText.tsx
//
// Renders text containing {{token}} placeholders with raw/merged toggle.
// Uses a single typography wrapper — never nest <Text> inside <Text>.

import {Badge, Inline, Text} from '@sanity/ui'
import {useEffect, useState, type CSSProperties} from 'react'
import type {SanityClient} from '@sanity/client'
import {
  extractTokens,
  resolveTokens,
  tokenChipMeta,
  type MergeField,
  type MinimalBrief,
} from '../../../personalization/generate/tokens'
import {previewTextFlow} from './previewCommon'

export type TokenMode = 'raw' | 'merged'

export interface TokenTextProps {
  text?: string
  mode: TokenMode
  brief: MinimalBrief
  mergeFields: MergeField[]
  client: SanityClient
  size?: 0 | 1 | 2 | 3 | 4
  muted?: boolean
  weight?: 'regular' | 'medium' | 'semibold' | 'bold'
  /** Block-level container (paragraphs, subject lines). Default inline. */
  block?: boolean
  style?: CSSProperties
}

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
}: {
  text: string
  brief: MinimalBrief
  mergeFields: MergeField[]
}) {
  const segments: Array<{type: 'plain'; value: string} | {type: 'chip'; key: string; raw: string}> =
    []
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
          return <span key={i}>{seg.value}</span>
        }
        const meta = tokenChipMeta(seg.key, mergeFields, brief)
        return (
          <span
            key={i}
            title={meta.resolverHint ? `${meta.source} — ${meta.resolverHint}` : meta.source}
            style={{
              background: CHIP_BG[meta.source],
              color: CHIP_FG[meta.source],
              borderRadius: 4,
              padding: '0 4px',
              margin: '0 1px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              whiteSpace: 'nowrap',
              display: 'inline',
              verticalAlign: 'baseline',
            }}
          >
            {seg.raw}
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
  weight = 'regular',
  block = false,
  style,
}: TokenTextProps) {
  const [resolved, setResolved] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  useEffect(() => {
    if (mode !== 'merged' || !text) {
      setResolved(null)
      return
    }
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

  const flowStyle = {...previewTextFlow, ...style}

  if (!text) {
    return (
      <Text as={block ? 'div' : 'span'} size={size} muted weight={weight}>
        —
      </Text>
    )
  }

  if (mode === 'merged') {
    if (resolving && resolved == null) {
      return (
        <Text as={block ? 'div' : 'span'} size={size} muted weight={weight} style={flowStyle}>
          Resolving tokens…
        </Text>
      )
    }
    return (
      <Text as={block ? 'div' : 'span'} size={size} muted={muted} weight={weight} style={flowStyle}>
        {resolved ?? text}
      </Text>
    )
  }

  return (
    <Text as={block ? 'div' : 'span'} size={size} muted={muted} weight={weight} style={flowStyle}>
      <RawChips text={text} brief={brief} mergeFields={mergeFields} />
    </Text>
  )
}

export function TokenLegend() {
  return (
    <Inline space={2}>
      <Badge tone="primary" mode="outline">
        Sanity
      </Badge>
      <Badge tone="caution" mode="outline">
        External
      </Badge>
      <Badge tone="critical" mode="outline">
        Unresolved
      </Badge>
    </Inline>
  )
}
