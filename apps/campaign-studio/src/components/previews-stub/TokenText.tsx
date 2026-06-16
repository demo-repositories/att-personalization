import {Box, Text, Card, Inline} from '@sanity/ui'
import {useState} from 'react'

/**
 * Local stub of TokenText. Pass 5 (@studio-ui-lead) ships the real shared
 * implementation under `@studio/ui/campaign/previews/TokenText`; swap the
 * import once that PR lands.
 *
 * Modes:
 *   - 'raw'    → tokens shown as colored chips (Sanity blue vs External purple).
 *   - 'merged' → tokens replaced with their resolved sampleValue.
 */
export type TokenMode = 'raw' | 'merged'

export interface TokenInfo {
  key: string
  source: 'sanity' | 'external' | 'unresolved'
  sampleValue?: string
  label?: string
}

const TOKEN_RE = /(\{\{\s*[a-zA-Z0-9_.-]+\s*\}\})/g

function chipColor(source: TokenInfo['source']) {
  if (source === 'sanity') return {bg: '#dbeafe', fg: '#1d4ed8', label: 'Sanity'}
  if (source === 'external') return {bg: '#ede9fe', fg: '#6d28d9', label: 'External'}
  return {bg: '#fee2e2', fg: '#b91c1c', label: 'Unresolved'}
}

export function TokenText({
  text,
  mode,
  tokens,
  size = 1,
}: {
  text: string
  mode: TokenMode
  tokens: Record<string, TokenInfo>
  size?: 0 | 1 | 2 | 3 | 4
}) {
  if (!text) return <Text size={size} muted>—</Text>

  if (mode === 'merged') {
    const merged = text.replace(TOKEN_RE, (raw) => {
      const key = raw.replace(/[{}\s]/g, '')
      return tokens[key]?.sampleValue ?? raw
    })
    return <Text size={size}>{merged}</Text>
  }

  // raw mode — split into chips and runs
  const parts = text.split(TOKEN_RE)
  return (
    <Text size={size}>
      {parts.map((p, i) => {
        if (!TOKEN_RE.test(p)) return <span key={i}>{p}</span>
        TOKEN_RE.lastIndex = 0
        const key = p.replace(/[{}\s]/g, '')
        const t = tokens[key]
        const c = chipColor(t?.source ?? 'unresolved')
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              padding: '0 6px',
              borderRadius: 4,
              background: c.bg,
              color: c.fg,
              fontWeight: 600,
              fontSize: '0.9em',
              margin: '0 2px',
            }}
            title={`Token: {{${key}}} — ${c.label}${t?.sampleValue ? ' → ' + t.sampleValue : ''}`}
          >
            {'{{'}{key}{'}}'}
          </span>
        )
      })}
    </Text>
  )
}

export function TokenModeToggle({mode, onModeChange}: {mode: TokenMode; onModeChange: (m: TokenMode) => void}) {
  return (
    <Inline space={1}>
      <button
        type="button"
        onClick={() => onModeChange('raw')}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          border: '1px solid #d1d5db',
          background: mode === 'raw' ? '#111827' : '#ffffff',
          color: mode === 'raw' ? '#ffffff' : '#374151',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Raw
      </button>
      <button
        type="button"
        onClick={() => onModeChange('merged')}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 500,
          border: '1px solid #d1d5db',
          background: mode === 'merged' ? '#111827' : '#ffffff',
          color: mode === 'merged' ? '#ffffff' : '#374151',
          borderRadius: 4,
          cursor: 'pointer',
        }}
      >
        Merged
      </button>
    </Inline>
  )
}
