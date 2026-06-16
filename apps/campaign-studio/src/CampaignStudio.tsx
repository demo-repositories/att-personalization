import {Card, Container, Flex, Box, Text, Button, Stack, useToast} from '@sanity/ui'
import {useCurrentUser, useClient} from '@sanity/sdk-react'
import {useEffect, useState, useCallback, Suspense} from 'react'
import type {SanityClient} from '@sanity/client'
import {BriefList} from './views/BriefList'
import {BriefEditor} from './views/BriefEditor'
import {MatrixView} from './views/MatrixView'
import {CONFIG_QUERY} from './queries'
import type {ChannelDoc, SegmentDoc, MergeFieldDoc} from './types'
import {ATT_BLUE} from './constants'

export type View =
  | {kind: 'list'}
  | {kind: 'edit'; briefId: string | 'new'}
  | {kind: 'matrix'; briefId: string}

export interface AppConfig {
  channels: ChannelDoc[]
  segments: SegmentDoc[]
  mergeFields: MergeFieldDoc[]
  products: Array<{_id: string; name?: string; price?: string}>
}

export function CampaignStudio() {
  const user = useCurrentUser()
  const client = useClient({apiVersion: '2024-11-12'}) as unknown as SanityClient
  const toast = useToast()
  const [view, setView] = useState<View>({kind: 'list'})
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [refreshTick, setRefreshTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .fetch(CONFIG_QUERY)
      .then((r: any) => {
        if (cancelled) return
        setConfig({
          channels: r.channels || [],
          segments: r.segments || [],
          mergeFields: r.mergeFields || [],
          products: r.products || [],
        })
      })
      .catch((e: unknown) => {
        if (cancelled) return
        toast.push({status: 'error', title: 'Failed to load config', description: String(e)})
      })
    return () => {
      cancelled = true
    }
  }, [client, toast])

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), [])

  return (
    <Box style={{minHeight: '100vh', background: '#f8fafc'}}>
      {/* Top app bar */}
      <Box style={{background: '#ffffff', borderBottom: '1px solid #e5e7eb'}}>
        <Container width={5}>
          <Flex padding={3} align="center" justify="space-between">
            <Flex align="center" gap={3}>
              <Box
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  background: ATT_BLUE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >
                AT
              </Box>
              <Stack space={1}>
                <Text size={2} weight="bold">AT&amp;T Campaign Studio</Text>
                <Text size={0} muted>Multi-channel personalization · POC</Text>
              </Stack>
            </Flex>
            <Flex align="center" gap={3}>
              {view.kind !== 'list' && (
                <Button text="All briefs" mode="ghost" onClick={() => setView({kind: 'list'})} />
              )}
              {user && (
                <Text size={1} muted>
                  Signed in as {user.name || user.email || user.id}
                </Text>
              )}
            </Flex>
          </Flex>
        </Container>
      </Box>

      <Container width={5}>
        <Box padding={4}>
          {!config ? (
            <Card padding={4}>
              <Text muted>Loading configuration…</Text>
            </Card>
          ) : view.kind === 'list' ? (
            <BriefList
              key={refreshTick}
              config={config}
              onEdit={(id) => setView({kind: 'edit', briefId: id})}
              onMatrix={(id) => setView({kind: 'matrix', briefId: id})}
              onCreate={() => setView({kind: 'edit', briefId: 'new'})}
            />
          ) : view.kind === 'edit' ? (
            <Suspense fallback={<Card padding={4}><Text muted>Loading brief…</Text></Card>}>
              <BriefEditor
                briefId={view.briefId}
                config={config}
                onBack={() => {
                  refresh()
                  setView({kind: 'list'})
                }}
                onGenerated={(id) => {
                  refresh()
                  setView({kind: 'matrix', briefId: id})
                }}
              />
            </Suspense>
          ) : (
            <MatrixView
              briefId={view.briefId}
              config={config}
              onEdit={(id) => setView({kind: 'edit', briefId: id})}
              onBack={() => setView({kind: 'list'})}
            />
          )}
        </Box>
      </Container>
    </Box>
  )
}
