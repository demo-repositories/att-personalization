import {Card, Stack, Flex, Text, Heading, Button, Box, Grid, Badge, Spinner, Select, TextInput} from '@sanity/ui'
import {useClient} from '@sanity/sdk-react'
import {useEffect, useState, useMemo} from 'react'
import type {SanityClient} from '@sanity/client'
import {BRIEF_LIST_QUERY} from '../queries'
import type {AppConfig} from '../CampaignStudio'

interface BriefRow {
  _id: string
  _rev: string
  _updatedAt: string
  title?: string
  slug?: {current?: string}
  campaignType: 'promotional' | 'abandoned-cart'
  goal?: string
  summary?: string
  targetChannelCount: number
  targetSegmentCount: number
  flowStepCount: number
  generated: number
  total: number
}

export function BriefList({
  config,
  onEdit,
  onMatrix,
  onCreate,
}: {
  config: AppConfig
  onEdit: (id: string) => void
  onMatrix: (id: string) => void
  onCreate: () => void
}) {
  const client = useClient({apiVersion: '2024-11-12'}) as unknown as SanityClient
  const [rows, setRows] = useState<BriefRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'promotional' | 'abandoned-cart'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    setRows(null)
    client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withConfig({perspective: "raw"}).fetch(BRIEF_LIST_QUERY)
      .then((r: any) => {
        if (cancelled) return
        setRows((r as BriefRow[]) || [])
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [client])

  const filtered = useMemo(() => {
    if (!rows) return null
    return rows.filter((r) => {
      if (filterType !== 'all' && r.campaignType !== filterType) return false
      if (search && !(r.title || '').toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [rows, filterType, search])

  const totals = useMemo(() => {
    if (!rows) return {briefs: 0, generated: 0, total: 0}
    return {
      briefs: rows.length,
      generated: rows.reduce((a, r) => a + (r.generated || 0), 0),
      total: rows.reduce((a, r) => a + (r.total || 0), 0),
    }
  }, [rows])

  if (error) {
    return (
      <Card padding={4} tone="critical">
        <Text>Failed to load briefs: {error}</Text>
      </Card>
    )
  }
  if (!rows || !filtered) {
    return (
      <Card padding={4}>
        <Flex align="center" gap={3}>
          <Spinner muted />
          <Text muted>Loading briefs…</Text>
        </Flex>
      </Card>
    )
  }

  const pct = totals.total > 0 ? Math.round((totals.generated / totals.total) * 100) : 0

  return (
    <Stack space={4}>
      {/* Header */}
      <Flex align="center" justify="space-between">
        <Stack space={2}>
          <Heading size={3}>Campaign briefs</Heading>
          <Text size={1} muted>
            {totals.briefs} {totals.briefs === 1 ? 'brief' : 'briefs'} · {config.channels.length} channels · {config.segments.length} segments
          </Text>
        </Stack>
        <Button text="New brief" tone="primary" onClick={onCreate} />
      </Flex>

      {/* Stat cards */}
      <Grid columns={[1, 3]} gap={3}>
        <StatCard label="Total briefs" value={String(totals.briefs)} />
        <StatCard label="Variations generated" value={`${totals.generated} / ${totals.total}`} />
        <StatCard label="Coverage" value={`${pct}%`} tone={pct >= 80 ? 'positive' : pct >= 40 ? 'caution' : 'default'} />
      </Grid>

      {/* Filters */}
      <Card padding={3} radius={2} shadow={1}>
        <Flex gap={3} align="center" wrap="wrap">
          <Box style={{minWidth: 240, flex: 1}}>
            <TextInput
              placeholder="Search by title"
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          </Box>
          <Box>
            <Select value={filterType} onChange={(e) => setFilterType(e.currentTarget.value as typeof filterType)}>
              <option value="all">All types</option>
              <option value="promotional">Promotional</option>
              <option value="abandoned-cart">Abandoned cart</option>
            </Select>
          </Box>
        </Flex>
      </Card>

      {/* Rows */}
      {filtered.length === 0 ? (
        <Card padding={5} radius={2} shadow={1}>
          <Stack space={3}>
            <Text align="center" muted>No briefs match the current filter.</Text>
            <Flex justify="center">
              <Button text="New brief" tone="primary" onClick={onCreate} />
            </Flex>
          </Stack>
        </Card>
      ) : (
        <Stack space={2}>
          {filtered.map((b) => (
            <BriefRowCard key={b._id} brief={b} onEdit={onEdit} onMatrix={onMatrix} />
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function StatCard({label, value, tone}: {label: string; value: string; tone?: 'positive' | 'caution' | 'default'}) {
  const color =
    tone === 'positive' ? '#059669' :
    tone === 'caution' ? '#d97706' :
    '#111827'
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Stack space={2}>
        <Text size={1} muted>{label}</Text>
        <Box>
          <Text size={4} weight="bold" style={{color}}>{value}</Text>
        </Box>
      </Stack>
    </Card>
  )
}

function BriefRowCard({
  brief,
  onEdit,
  onMatrix,
}: {
  brief: BriefRow
  onEdit: (id: string) => void
  onMatrix: (id: string) => void
}) {
  const pct = brief.total > 0 ? Math.round((brief.generated / brief.total) * 100) : 0
  return (
    <Card padding={4} radius={2} shadow={1}>
      <Flex align="center" gap={4} wrap="wrap">
        <Stack space={2} flex={1} style={{minWidth: 0}}>
          <Flex align="center" gap={2} wrap="wrap">
            <Heading size={1}>{brief.title || '(untitled)'}</Heading>
            <Badge tone={brief.campaignType === 'abandoned-cart' ? 'caution' : 'primary'}>
              {brief.campaignType === 'abandoned-cart' ? 'Abandoned cart' : 'Promotional'}
            </Badge>
            {brief.goal && <Badge tone="default">{brief.goal}</Badge>}
          </Flex>
          <Text size={1} muted textOverflow="ellipsis">
            {brief.summary || '(no summary)'}
          </Text>
          <Flex gap={3} align="center">
            <Text size={0} muted>{brief.targetChannelCount} channels</Text>
            <Text size={0} muted>·</Text>
            <Text size={0} muted>{brief.targetSegmentCount} segments</Text>
            {brief.campaignType === 'abandoned-cart' && (
              <>
                <Text size={0} muted>·</Text>
                <Text size={0} muted>{brief.flowStepCount} flow steps</Text>
              </>
            )}
          </Flex>
        </Stack>
        <Box style={{minWidth: 180}}>
          <Stack space={2}>
            <Flex justify="space-between">
              <Text size={0} muted>Coverage</Text>
              <Text size={0} weight="medium">{brief.generated} / {brief.total}</Text>
            </Flex>
            <Box style={{height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden'}}>
              <Box style={{height: '100%', width: `${pct}%`, background: pct >= 80 ? '#059669' : pct >= 40 ? '#d97706' : '#3b82f6'}} />
            </Box>
            <Text size={0} muted>{pct}% generated</Text>
          </Stack>
        </Box>
        <Flex gap={2}>
          <Button text="Edit" mode="ghost" onClick={() => onEdit(brief._id)} />
          <Button text="Matrix" tone="primary" onClick={() => onMatrix(brief._id)} />
        </Flex>
      </Flex>
    </Card>
  )
}
