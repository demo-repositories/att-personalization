// apps/campaign-studio/src/views/VariationEditor.tsx
//
// Edit-in-place editor for a single generated variation — implements the
// "Edit Variation" brief §02/§05/§06. Reads and writes go straight to the
// Content Lake through App SDK hooks (no round-trip to Studio):
//
//   useDocument        → live, optimistic value at a field path (no useState)
//   useEditDocument    → write a field path; auto-creates a draft on first edit
//   useApplyDocumentActions + publishDocument → Approve (draft → published)
//   useDocumentPermissions → gate inputs (update) and the Approve action (publish)
//   useDocumentSyncStatus  → "Saving…/Saved" indicator
//
// A variation is a `contentVariation` document with embedded web/email/sms
// objects; only the matching channel is edited here. `body` is Portable Text —
// rich-text block editing is out of scope per the brief, so body renders
// read-only in the live preview and the editor exposes the scalar fields
// (subject/headline/CTA/message/link) plus the web hero image.

import {
  Badge,
  Box,
  Button,
  Card,
  Dialog,
  Flex,
  Grid,
  Inline,
  Spinner,
  Stack,
  Text,
  TextArea,
  TextInput,
  useToast,
} from '@sanity/ui'
import {
  BoldIcon,
  CheckmarkCircleIcon,
  ItalicIcon,
  OlistIcon,
  UlistIcon,
  UnderlineIcon,
  WarningOutlineIcon,
} from '@sanity/icons'
import {
  EditorProvider,
  PortableTextEditable,
  defineSchema,
  useEditor,
  useEditorSelector,
  type PortableTextBlock as PTEditorBlock,
  type RenderDecoratorFunction,
  type RenderListItemFunction,
  type RenderStyleFunction,
} from '@portabletext/editor'
import {EventListenerPlugin} from '@portabletext/editor/plugins'
import * as selectors from '@portabletext/editor/selectors'
import {
  createDocumentHandle,
  editDocument,
  publishDocument,
  useApplyDocumentActions,
  useDocument,
  useDocumentPermissions,
  useDocumentSyncStatus,
  useEditDocument,
  type DocumentHandle,
} from '@sanity/sdk-react'
import {Suspense, useMemo, useRef, type ComponentProps} from 'react'
import type {SanityClient} from '@sanity/client'

import {WebHeroCard, type WebContent} from '@studio/ui/campaign/previews/WebHeroCard'
import {EmailClientMock, type EmailContent} from '@studio/ui/campaign/previews/EmailClientMock'
import {PhoneSmsBubble, type SmsContent} from '@studio/ui/campaign/previews/PhoneSmsBubble'
import {TokenLegend, type TokenMode} from '@studio/ui/campaign/previews/TokenText'
import {extractTokens, tokenChipMeta} from '@studio/personalization/generate/tokens'
import type {MergeField, MinimalBrief} from '@studio/personalization/generate/tokens'

import {AllowedMediaPicker, type MediaAssetOption} from '../components/AllowedMediaPicker'
import type {ChannelKey} from '../types'

type ChannelData = Partial<WebContent & EmailContent & SmsContent>

export interface VariationEditorProps {
  /** Canonical document id (no `drafts.` prefix). */
  documentId: string
  channelKey: ChannelKey
  channelLabel: string
  segmentTitle: string
  brand?: string
  brandColor?: string
  stepKey?: string
  stepIntent?: string
  /** Variation status — locks the editor while `generating`. */
  status?: string
  client: SanityClient
  brief: MinimalBrief
  briefRev?: string
  mergeFields: MergeField[]
  /** Media options constrained to the brief's allowed assets (web hero only). */
  allowedMedia: MediaAssetOption[]
  initialTokenMode: TokenMode
  onClose: () => void
  /** Called after a successful publish so the matrix can refetch. */
  onSaved: () => void
}

export function VariationEditor(props: VariationEditorProps) {
  const {channelLabel, segmentTitle, stepKey, onClose} = props
  const header = `${channelLabel} × ${segmentTitle}${stepKey ? ` · ${stepKey}` : ''}`

  return (
    <Dialog id="variation-editor" header={header} width={3} onClose={onClose}>
      <Box padding={4}>
        <Suspense
          fallback={
            <Flex align="center" justify="center" gap={3} padding={5}>
              <Spinner muted />
              <Text muted size={1}>
                Loading variation…
              </Text>
            </Flex>
          }
        >
          <EditorBody {...props} />
        </Suspense>
      </Box>
    </Dialog>
  )
}

function EditorBody(props: VariationEditorProps) {
  const {
    documentId,
    channelKey,
    brand,
    brandColor,
    stepIntent,
    status,
    client,
    brief,
    briefRev: _briefRev,
    mergeFields,
    allowedMedia,
    initialTokenMode,
    onClose,
    onSaved,
  } = props
  const toast = useToast()

  const handle = useMemo(
    () => createDocumentHandle({documentId, documentType: 'contentVariation'}),
    [documentId],
  )

  // Live, optimistic value of the whole channel object — drives both the form
  // inputs and the live preview without any local form state.
  const {data} = useDocument<ChannelData>({...handle, path: channelKey})
  const channel = data ?? {}

  const updatePerm = useDocumentPermissions(editDocument(handle))
  const publishPerm = useDocumentPermissions(publishDocument(handle))
  const synced = useDocumentSyncStatus(handle)
  const apply = useApplyDocumentActions()

  const locked = status === 'generating' || !updatePerm.allowed

  // ---- Validation: SMS length + unresolved merge tokens (brief §06/§07) ----
  const editableText = [
    channel.subjectLine,
    channel.preheader,
    channel.headline,
    channel.subheadline,
    channel.ctaLabel,
    channel.message,
    ...asBlocks(channel.body).map(blockToText),
  ]
    .filter(Boolean)
    .join('\n')

  const unresolvedTokens = useMemo(() => {
    const out: string[] = []
    const seen = new Set<string>()
    for (const {key, raw} of extractTokens(editableText)) {
      if (tokenChipMeta(key, mergeFields, brief).source === 'unresolved' && !seen.has(raw)) {
        seen.add(raw)
        out.push(raw)
      }
    }
    return out
  }, [editableText, mergeFields, brief])

  const smsLength = (channel.message ?? '').length
  const smsOverLimit = channelKey === 'sms' && smsLength > 160

  const canApprove =
    publishPerm.allowed && status !== 'generating' && !smsOverLimit && unresolvedTokens.length === 0

  async function approve() {
    try {
      await apply(publishDocument(handle))
      toast.push({status: 'success', title: 'Published', description: 'Variation approved.'})
      onSaved()
      onClose()
    } catch (e) {
      toast.push({status: 'error', title: 'Publish failed', description: String(e)})
    }
  }

  return (
    <Stack space={4}>
      {/* Status / lifecycle row */}
      <Flex align="center" justify="space-between" gap={3} wrap="wrap">
        <Inline space={2}>
          {status === 'generating' ? (
            <Badge tone="caution" mode="outline">
              Generating — locked
            </Badge>
          ) : synced ? (
            <Badge tone="positive" mode="outline">
              Saved
            </Badge>
          ) : (
            <Badge tone="caution" mode="outline">
              Saving…
            </Badge>
          )}
          {smsOverLimit ? <Badge tone="critical">Over limit · {smsLength}/160</Badge> : null}
          {unresolvedTokens.length > 0 ? (
            <Badge tone="critical">
              {unresolvedTokens.length} unresolved token{unresolvedTokens.length > 1 ? 's' : ''}
            </Badge>
          ) : null}
        </Inline>
        {!updatePerm.allowed ? (
          <Text size={1} muted>
            Read-only — you don’t have edit permission.
          </Text>
        ) : null}
      </Flex>

      {stepIntent ? (
        <Stack space={1}>
          <Text size={0} muted style={{textTransform: 'uppercase', letterSpacing: 0.5}}>
            Step intent
          </Text>
          <Text size={1}>{stepIntent}</Text>
        </Stack>
      ) : null}

      <Grid columns={[1, 1, 2]} gap={4}>
        {/* ---- Form ---- */}
        <Stack space={4}>
          {channelKey === 'web' ? (
            <WebFields handle={handle} channel={channel} locked={locked} />
          ) : channelKey === 'email' ? (
            <EmailFields handle={handle} channel={channel} locked={locked} />
          ) : (
            <SmsFields handle={handle} channel={channel} locked={locked} smsLength={smsLength} />
          )}

          {channelKey === 'web' ? (
            <HeroImageField
              handle={handle}
              client={client}
              channel={channel}
              allowedMedia={allowedMedia}
              locked={locked}
            />
          ) : null}

          {/* Portable Text body — per-block text + heading style + reorder. */}
          {channelKey !== 'sms' ? (
            <FieldRow
              label="Body"
              hint="Rich text — bold, italic, headings, and lists. Changes save to the draft as you type."
            >
              <BodyEditor
                handle={handle}
                bodyPath={`${channelKey}.body`}
                blocks={(channel.body as PortableTextBlock[]) ?? []}
                locked={locked}
              />
            </FieldRow>
          ) : null}
        </Stack>

        {/* ---- Live preview ---- */}
        <Stack space={3}>
          <Flex align="center" justify="space-between">
            <Text size={1} weight="semibold">
              Live preview
            </Text>
            {initialTokenMode === 'raw' ? <TokenLegend /> : null}
          </Flex>
          <Box style={{maxWidth: 420}}>
            {channelKey === 'web' ? (
              <WebHeroCard
                client={client}
                web={channel as WebContent}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={initialTokenMode}
              />
            ) : channelKey === 'email' ? (
              <EmailClientMock
                client={client}
                email={channel as EmailContent}
                brand={brand}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={initialTokenMode}
              />
            ) : (
              <PhoneSmsBubble
                client={client}
                sms={channel as SmsContent}
                brand={brand}
                brandColor={brandColor}
                brief={brief}
                mergeFields={mergeFields}
                tokenMode={initialTokenMode}
              />
            )}
          </Box>
        </Stack>
      </Grid>

      {/* ---- Actions ---- */}
      <Flex justify="flex-end" gap={2} wrap="wrap" paddingTop={2}>
        <Button text="Close" mode="ghost" onClick={onClose} />
        <Button
          text="Approve & publish"
          icon={canApprove ? CheckmarkCircleIcon : WarningOutlineIcon}
          tone="positive"
          disabled={!canApprove}
          onClick={approve}
        />
      </Flex>
      {!canApprove && publishPerm.allowed && status !== 'generating' ? (
        <Text size={0} muted align="right">
          {smsOverLimit
            ? 'Trim the message to 160 characters to approve.'
            : unresolvedTokens.length > 0
              ? `Resolve ${unresolvedTokens.join(', ')} to approve.`
              : ''}
        </Text>
      ) : null}
      {!publishPerm.allowed ? (
        <Text size={0} muted align="right">
          You don’t have permission to publish this variation.
        </Text>
      ) : null}
    </Stack>
  )
}

/* ---------------------------------------------------------------------- */
/* Field primitives — each owns its own useEditDocument at a field path.  */
/* Values are read from the parent's live `channel` object (no useState). */
/* ---------------------------------------------------------------------- */

function FieldRow({label, hint, children}: {label: string; hint?: string; children: React.ReactNode}) {
  return (
    <Stack space={2}>
      <Text size={1} weight="medium" muted>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text size={0} muted>
          {hint}
        </Text>
      ) : null}
    </Stack>
  )
}

function EditableInput({
  handle,
  path,
  value,
  disabled,
  ...rest
}: {
  handle: DocumentHandle
  path: string
  value?: string
  disabled?: boolean
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChange'>) {
  const edit = useEditDocument<string>({...handle, path})
  return (
    <TextInput
      value={value ?? ''}
      readOnly={disabled}
      onChange={(e) => edit(e.currentTarget.value)}
      {...rest}
    />
  )
}

function EditableArea({
  handle,
  path,
  value,
  disabled,
  ...rest
}: {
  handle: DocumentHandle
  path: string
  value?: string
  disabled?: boolean
} & Omit<ComponentProps<typeof TextArea>, 'value' | 'onChange'>) {
  const edit = useEditDocument<string>({...handle, path})
  return (
    <TextArea
      value={value ?? ''}
      readOnly={disabled}
      onChange={(e) => edit(e.currentTarget.value)}
      {...rest}
    />
  )
}

function CharCount({length, max}: {length: number; max: number}) {
  const over = length > max
  return (
    <Text size={0} muted={!over} style={over ? {color: '#dc2626'} : undefined} align="right">
      {length}/{max}
      {over ? ' · over limit' : ''}
    </Text>
  )
}

function WebFields({
  handle,
  channel,
  locked,
}: {
  handle: DocumentHandle
  channel: ChannelData
  locked: boolean
}) {
  return (
    <Stack space={4}>
      <FieldRow label="Headline">
        <EditableInput handle={handle} path="web.headline" value={channel.headline} disabled={locked} />
      </FieldRow>
      <FieldRow label="Subheadline">
        <EditableInput
          handle={handle}
          path="web.subheadline"
          value={channel.subheadline}
          disabled={locked}
        />
      </FieldRow>
      <FieldRow label="CTA label">
        <EditableInput handle={handle} path="web.ctaLabel" value={channel.ctaLabel} disabled={locked} />
      </FieldRow>
      <FieldRow label="CTA URL">
        <EditableInput
          handle={handle}
          path="web.ctaUrl"
          value={channel.ctaUrl}
          disabled={locked}
          placeholder="https://www.att.com/…"
        />
      </FieldRow>
    </Stack>
  )
}

function EmailFields({
  handle,
  channel,
  locked,
}: {
  handle: DocumentHandle
  channel: ChannelData
  locked: boolean
}) {
  return (
    <Stack space={4}>
      <FieldRow label="Subject line">
        <Stack space={1}>
          <EditableInput
            handle={handle}
            path="email.subjectLine"
            value={channel.subjectLine}
            disabled={locked}
          />
          <CharCount length={(channel.subjectLine ?? '').length} max={60} />
        </Stack>
      </FieldRow>
      <FieldRow label="Preheader">
        <Stack space={1}>
          <EditableInput
            handle={handle}
            path="email.preheader"
            value={channel.preheader}
            disabled={locked}
          />
          <CharCount length={(channel.preheader ?? '').length} max={110} />
        </Stack>
      </FieldRow>
      <FieldRow label="CTA label">
        <EditableInput handle={handle} path="email.ctaLabel" value={channel.ctaLabel} disabled={locked} />
      </FieldRow>
      <FieldRow label="CTA URL">
        <EditableInput
          handle={handle}
          path="email.ctaUrl"
          value={channel.ctaUrl}
          disabled={locked}
          placeholder="https://www.att.com/…"
        />
      </FieldRow>
    </Stack>
  )
}

function SmsFields({
  handle,
  channel,
  locked,
  smsLength,
}: {
  handle: DocumentHandle
  channel: ChannelData
  locked: boolean
  smsLength: number
}) {
  return (
    <Stack space={4}>
      <FieldRow label="Message">
        <Stack space={1}>
          <EditableArea
            handle={handle}
            path="sms.message"
            value={channel.message}
            disabled={locked}
            rows={4}
          />
          <CharCount length={smsLength} max={160} />
        </Stack>
      </FieldRow>
      <FieldRow label="Link">
        <EditableInput
          handle={handle}
          path="sms.link"
          value={channel.link}
          disabled={locked}
          placeholder="https://www.att.com/…"
        />
      </FieldRow>
    </Stack>
  )
}

/* ---------------------------------------------------------------------- */
/* Portable Text body editor — a real rich-text editor (@portabletext/      */
/* editor), same engine Studio uses. Uncontrolled: seeded once from the     */
/* document, syncs OUT to the Content Lake on every mutation via            */
/* useEditDocument. Toolbar: bold/italic/underline, H2/H3, lists.           */
/* ---------------------------------------------------------------------- */

interface PTSpan {
  _type: 'span'
  _key?: string
  text?: string
  marks?: string[]
}
interface PortableTextBlock {
  _type: 'block'
  _key?: string
  style?: string
  children?: PTSpan[]
  markDefs?: unknown[]
  listItem?: string
  level?: number
}

function blockToText(block: PortableTextBlock): string {
  return (block.children ?? []).map((c) => c?.text ?? '').join('')
}

function asBlocks(value: unknown): PortableTextBlock[] {
  return Array.isArray(value) ? (value as PortableTextBlock[]) : []
}

// Mirrors the defaults of Sanity's `block` type so existing AI-generated
// content (headings, marks, links) round-trips without being flagged invalid.
const BODY_SCHEMA = defineSchema({
  styles: [
    {name: 'normal', title: 'Normal'},
    {name: 'h1', title: 'Heading 1'},
    {name: 'h2', title: 'Heading 2'},
    {name: 'h3', title: 'Heading 3'},
    {name: 'h4', title: 'Heading 4'},
    {name: 'blockquote', title: 'Quote'},
  ],
  decorators: [
    {name: 'strong', title: 'Bold'},
    {name: 'em', title: 'Italic'},
    {name: 'underline', title: 'Underline'},
    {name: 'strike-through', title: 'Strike'},
    {name: 'code', title: 'Code'},
  ],
  lists: [
    {name: 'bullet', title: 'Bulleted'},
    {name: 'number', title: 'Numbered'},
  ],
  annotations: [
    {name: 'link', title: 'Link', fields: [{name: 'href', type: 'string', title: 'URL'}]},
  ],
})

const renderDecorator: RenderDecoratorFunction = (props) => {
  switch (props.value) {
    case 'strong':
      return <strong>{props.children}</strong>
    case 'em':
      return <em>{props.children}</em>
    case 'underline':
      return <span style={{textDecoration: 'underline'}}>{props.children}</span>
    case 'strike-through':
      return <span style={{textDecoration: 'line-through'}}>{props.children}</span>
    case 'code':
      return (
        <code
          style={{
            fontFamily: 'ui-monospace, monospace',
            background: '#f1f5f9',
            padding: '0 3px',
            borderRadius: 3,
          }}
        >
          {props.children}
        </code>
      )
    default:
      return <>{props.children}</>
  }
}

const renderStyle: RenderStyleFunction = (props) => {
  const base = {margin: '0 0 8px'}
  switch (props.value) {
    case 'h1':
      return <div style={{...base, fontSize: 22, fontWeight: 700, lineHeight: 1.2}}>{props.children}</div>
    case 'h2':
      return <div style={{...base, fontSize: 18, fontWeight: 700, lineHeight: 1.25}}>{props.children}</div>
    case 'h3':
      return <div style={{...base, fontSize: 16, fontWeight: 600, lineHeight: 1.3}}>{props.children}</div>
    case 'h4':
      return <div style={{...base, fontSize: 14, fontWeight: 600}}>{props.children}</div>
    case 'blockquote':
      return (
        <blockquote style={{...base, borderLeft: '3px solid #d1d5db', paddingLeft: 12, color: '#6b7280'}}>
          {props.children}
        </blockquote>
      )
    default:
      return <div style={{...base, fontSize: 14, lineHeight: 1.55}}>{props.children}</div>
  }
}

const renderListItem: RenderListItemFunction = (props) => (
  <div style={{display: 'flex', gap: 8}}>
    <span style={{color: '#6b7280'}}>{props.value === 'number' ? '1.' : '•'}</span>
    <div style={{flex: 1}}>{props.children}</div>
  </div>
)

const renderPlaceholder = () => (
  <span style={{color: '#9ca3af'}}>Empty — type or paste body copy…</span>
)

function BodyEditor({
  handle,
  bodyPath,
  blocks,
  locked,
}: {
  handle: DocumentHandle
  bodyPath: string
  /** Current value — captured once as the editor's initial value. */
  blocks: PortableTextBlock[]
  locked: boolean
}) {
  const editBody = useEditDocument<PortableTextBlock[]>({...handle, path: bodyPath})
  // The editor is uncontrolled: seed once, then only sync OUT. Re-using a ref
  // keeps the initial value stable across the parent's per-keystroke renders.
  const initialValueRef = useRef(blocks)
  const lastWrittenRef = useRef(JSON.stringify(blocks))
  const config = useMemo(
    () => ({
      schemaDefinition: BODY_SCHEMA,
      initialValue: initialValueRef.current as unknown as PTEditorBlock[],
      readOnly: locked,
    }),
    // Built once on mount — `locked` rarely flips mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <EditorProvider initialConfig={config}>
      <EventListenerPlugin
        on={(event) => {
          if (event.type !== 'mutation') return
          const next = (event.value ?? []) as PortableTextBlock[]
          const json = JSON.stringify(next)
          if (json === lastWrittenRef.current) return // ignore no-op normalization
          lastWrittenRef.current = json
          editBody(next)
        }}
      />
      <Stack space={2}>
        <BodyToolbar locked={locked} />
        <Card border radius={2} padding={3} tone="transparent" style={{minHeight: 140}}>
          <PortableTextEditable
            renderDecorator={renderDecorator}
            renderStyle={renderStyle}
            renderListItem={renderListItem}
            renderPlaceholder={renderPlaceholder}
            style={{outline: 'none', minHeight: 120, fontSize: 14, lineHeight: 1.55}}
          />
        </Card>
      </Stack>
    </EditorProvider>
  )
}

function ToolbarButton(props: ComponentProps<typeof Button> & {active?: boolean}) {
  const {active, ...rest} = props
  return <Button mode="bleed" padding={2} fontSize={1} selected={active} {...rest} />
}

function BodyToolbar({locked}: {locked: boolean}) {
  const editor = useEditor()
  const bold = useEditorSelector(editor, selectors.isActiveDecorator('strong'))
  const italic = useEditorSelector(editor, selectors.isActiveDecorator('em'))
  const underline = useEditorSelector(editor, selectors.isActiveDecorator('underline'))
  const isH2 = useEditorSelector(editor, selectors.isActiveStyle('h2'))
  const isH3 = useEditorSelector(editor, selectors.isActiveStyle('h3'))
  const bullet = useEditorSelector(editor, selectors.isActiveListItem('bullet'))
  const numbered = useEditorSelector(editor, selectors.isActiveListItem('number'))

  const toggleDecorator = (decorator: string) => {
    editor.send({type: 'decorator.toggle', decorator})
    editor.send({type: 'focus'})
  }
  const toggleStyle = (style: string) => {
    editor.send({type: 'style.toggle', style})
    editor.send({type: 'focus'})
  }
  const toggleList = (listItem: string) => {
    editor.send({type: 'list item.toggle', listItem})
    editor.send({type: 'focus'})
  }

  const divider = <Box style={{width: 1, height: 20, background: '#e5e7eb', margin: '0 4px'}} />

  return (
    <Flex gap={1} wrap="wrap" align="center">
      <ToolbarButton icon={BoldIcon} title="Bold" active={bold} disabled={locked} onClick={() => toggleDecorator('strong')} />
      <ToolbarButton icon={ItalicIcon} title="Italic" active={italic} disabled={locked} onClick={() => toggleDecorator('em')} />
      <ToolbarButton icon={UnderlineIcon} title="Underline" active={underline} disabled={locked} onClick={() => toggleDecorator('underline')} />
      {divider}
      <ToolbarButton text="H2" title="Heading" active={isH2} disabled={locked} onClick={() => toggleStyle('h2')} />
      <ToolbarButton text="H3" title="Subheading" active={isH3} disabled={locked} onClick={() => toggleStyle('h3')} />
      {divider}
      <ToolbarButton icon={UlistIcon} title="Bulleted list" active={bullet} disabled={locked} onClick={() => toggleList('bullet')} />
      <ToolbarButton icon={OlistIcon} title="Numbered list" active={numbered} disabled={locked} onClick={() => toggleList('number')} />
    </Flex>
  )
}

function HeroImageField({
  handle,
  client,
  channel,
  allowedMedia,
  locked,
}: {
  handle: DocumentHandle
  client: SanityClient
  channel: ChannelData
  allowedMedia: MediaAssetOption[]
  locked: boolean
}) {
  const editHero = useEditDocument({...handle, path: 'web.heroImage'})
  const currentAssetRef = channel.heroImage?.asset?._ref
  const currentUrl = channel.heroImage?.url
  const selectedId = allowedMedia.find((m) =>
    currentUrl ? m.url === currentUrl : m.assetRef === currentAssetRef,
  )?._id

  function setHero(mediaId: string | null) {
    if (!mediaId) {
      editHero(undefined as never)
      return
    }
    const asset = allowedMedia.find((m) => m._id === mediaId)
    if (!asset) return
    if (asset.url) {
      // Media Library asset — carry the CDN url (no project asset ref exists).
      editHero({_type: 'image', url: asset.url} as never)
    } else if (asset.assetRef) {
      editHero({
        _type: 'image',
        asset: {_type: 'reference', _ref: asset.assetRef},
      } as never)
    }
  }

  return (
    <FieldRow
      label="Hero image"
      hint="Constrained to the brief’s allowed media — other assets are rejected."
    >
      {locked ? (
        <Text size={1} muted>
          Locked while generating.
        </Text>
      ) : (
        <AllowedMediaPicker
          client={client}
          options={allowedMedia}
          value={selectedId ? [selectedId] : []}
          onChange={(ids) => {
            // Single-select: pick the newly checked id, or clear if unchecked.
            const next = ids.find((id) => id !== selectedId) ?? null
            setHero(next)
          }}
        />
      )}
    </FieldRow>
  )
}
