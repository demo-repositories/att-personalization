import {SanityApp} from '@sanity/sdk-react'
import type {SanityConfig} from '@sanity/sdk'
import {ThemeProvider, ToastProvider, Card, Flex, Spinner, Stack, Text} from '@sanity/ui'
import {Suspense} from 'react'
import {theme} from './theme'
import {PROJECT_ID, DATASET} from './constants'
import {CampaignStudio} from './CampaignStudio'

const sanityConfigs: SanityConfig[] = [
  {projectId: PROJECT_ID, dataset: DATASET},
]

function AppLoading({label = 'Loading…'}: {label?: string}) {
  return (
    <Card padding={5} height="fill">
      <Flex align="center" justify="center" height="fill">
        <Stack space={3}>
          <Flex justify="center">
            <Spinner muted />
          </Flex>
          <Text align="center" muted size={1}>{label}</Text>
        </Stack>
      </Flex>
    </Card>
  )
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <ToastProvider>
        <SanityApp config={sanityConfigs} fallback={<AppLoading label="Signing in to Sanity…" />}>
          <Suspense fallback={<AppLoading />}>
            <CampaignStudio />
          </Suspense>
        </SanityApp>
      </ToastProvider>
    </ThemeProvider>
  )
}
