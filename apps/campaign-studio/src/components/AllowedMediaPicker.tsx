import {Box, Card, Checkbox, Flex, Stack, Text} from '@sanity/ui'
import imageUrlBuilder from '@sanity/image-url'
import type {SanityClient} from '@sanity/client'

export interface MediaAssetOption {
  _id: string
  title?: string
  description?: string
  assetRef?: string
  /** Direct CDN URL for assets curated from the Sanity Media Library. */
  url?: string
}

export function AllowedMediaPicker({
  client,
  options,
  value,
  onChange,
}: {
  client: SanityClient
  options: MediaAssetOption[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  if (options.length === 0) {
    return (
      <Card padding={3} radius={2} tone="caution" border>
        <Stack space={2}>
          <Text size={1} weight="medium">
            No media assets in the library yet
          </Text>
          <Text size={1} muted>
            Open Sanity Studio → <strong>Media library</strong> to upload images, then attach them here.
          </Text>
        </Stack>
      </Card>
    )
  }

  return (
    <Stack space={2}>
      {options.map((asset) => {
        const checked = value.includes(asset._id)
        let thumbUrl: string | undefined
        if (asset.url) {
          // Media Library asset — use the CDN URL with transform params.
          thumbUrl = `${asset.url}?w=120&h=68&fit=crop&auto=format`
        } else if (asset.assetRef) {
          try {
            thumbUrl = imageUrlBuilder(client)
              .image({_ref: asset.assetRef})
              .width(120)
              .height(68)
              .fit('crop')
              .url()
          } catch {
            thumbUrl = undefined
          }
        }
        return (
          <Card key={asset._id} padding={2} radius={2} border tone={checked ? 'primary' : 'default'}>
            <Flex align="center" gap={3}>
              <Checkbox
                checked={checked}
                onChange={(e) => {
                  if (e.currentTarget.checked) onChange([...value, asset._id])
                  else onChange(value.filter((id) => id !== asset._id))
                }}
              />
              <Box
                style={{
                  width: 80,
                  height: 45,
                  borderRadius: 4,
                  overflow: 'hidden',
                  background: '#e5e7eb',
                  flexShrink: 0,
                }}
              >
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt=""
                    style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
                  />
                ) : null}
              </Box>
              <Stack space={1} flex={1} style={{minWidth: 0}}>
                <Text size={1} weight="semibold" textOverflow="ellipsis">
                  {asset.title || asset._id}
                </Text>
                {asset.description ? (
                  <Text size={0} muted textOverflow="ellipsis">
                    {asset.description}
                  </Text>
                ) : null}
              </Stack>
            </Flex>
          </Card>
        )
      })}
    </Stack>
  )
}
