import {
  Card, Stack, Flex, Text, Heading, Button, Box, Grid, TextInput, TextArea, Select,
  Checkbox, Label, useToast, Badge, Inline
} from '@sanity/ui'
import {useClient} from '@sanity/sdk-react'
import {useEffect, useState, useMemo} from 'react'
import type {SanityClient} from '@sanity/client'
import {BRIEF_DETAIL_QUERY} from '../queries'
import type {AppConfig} from '../CampaignStudio'
import type {CampaignBrief, FlowStep} from '../types'
import {GenerateDialog} from './GenerateDialog'

interface BriefEditorProps {
  briefId: string | 'new'
  config: AppConfig
  onBack: () => void
  onGenerated: (id: string) => void
}

function emptyBrief(): CampaignBrief {
  return {
    _id: `brief-${Date.now().toString(36)}`,
    _type: 'campaignBrief',
    campaignType: 'promotional',
    title: '',
    summary: '',
  }
}

export function BriefEditor({briefId, config, onBack, onGenerated}: BriefEditorProps) {
  const client = useClient({apiVersion: '2024-11-12'}) as unknown as SanityClient
  const toast = useToast()
  const [brief, setBrief] = useState<CampaignBrief | null>(briefId === 'new' ? emptyBrief() : null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)

  useEffect(() => {
    if (briefId === 'new') return
    let cancelled = false
    client
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withConfig({perspective: "raw"}).fetch(BRIEF_DETAIL_QUERY, {id: briefId})
      .then((r: any) => {
        if (cancelled) return
        if (!r) {
          setLoadError(`Brief not found: ${briefId}`)
        } else {
          setBrief(r as CampaignBrief)
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(String(e))
      })
    return () => {
      cancelled = true
    }
  }, [client, briefId])

  const valid = useMemo(() => {
    if (!brief) return false
    return !!(brief.title && brief.title.trim() && brief.summary && brief.summary.trim() && brief.campaignType)
  }, [brief])

  if (loadError) {
    return (
      <Card padding={4} tone="critical">
        <Stack space={3}>
          <Text>{loadError}</Text>
          <Button text="Back to list" mode="ghost" onClick={onBack} />
        </Stack>
      </Card>
    )
  }
  if (!brief) {
    return (
      <Card padding={4}>
        <Text muted>Loading brief…</Text>
      </Card>
    )
  }

  function update<K extends keyof CampaignBrief>(key: K, value: CampaignBrief[K]) {
    setBrief((b) => (b ? {...b, [key]: value} : b))
  }

  async function save(thenAction?: 'generate' | 'matrix') {
    if (!brief || !valid) {
      toast.push({status: 'warning', title: 'Required fields missing', description: 'Title, summary, and campaign type are required.'})
      return
    }
    setSaving(true)
    try {
      // Strip _rev so createOrReplace works against either draft or published.
      // Use the draft id so edits land as drafts (matches Studio conventions).
      const cleanId = brief._id.startsWith('drafts.') ? brief._id : brief._id
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const {_rev, ...doc} = brief
      await client.createOrReplace({...doc, _id: cleanId, _type: 'campaignBrief'} as any)
      toast.push({status: 'success', title: 'Saved', description: brief.title || brief._id})
      if (thenAction === 'generate') {
        setGenerateOpen(true)
      } else if (thenAction === 'matrix') {
        onGenerated(cleanId)
      }
    } catch (e) {
      toast.push({status: 'error', title: 'Save failed', description: String(e)})
    } finally {
      setSaving(false)
    }
  }

  const isAbandonedCart = brief.campaignType === 'abandoned-cart'

  return (
    <Stack space={4}>
      <Flex align="center" justify="space-between">
        <Stack space={1}>
          <Button text="← Back to briefs" mode="bleed" onClick={onBack} />
          <Heading size={3}>{briefId === 'new' ? 'New brief' : brief.title || '(untitled)'}</Heading>
        </Stack>
        <Flex gap={2}>
          <Button text="Save" mode="ghost" disabled={!valid || saving} loading={saving} onClick={() => save()} />
          <Button text="Save & generate" tone="primary" disabled={!valid || saving} onClick={() => save('generate')} />
        </Flex>
      </Flex>

      <Card padding={4} radius={2} shadow={1}>
        <Stack space={4}>
          <SectionHeading title="Brief" />

          <FieldRow label="Title" required>
            <TextInput value={brief.title ?? ''} onChange={(e) => update('title', e.currentTarget.value)} />
          </FieldRow>

          <FieldRow label="Campaign type" required>
            <Select
              value={brief.campaignType}
              onChange={(e) => update('campaignType', e.currentTarget.value as CampaignBrief['campaignType'])}
            >
              <option value="promotional">Promotional (one-shot)</option>
              <option value="abandoned-cart">Abandoned cart (multi-step)</option>
            </Select>
          </FieldRow>

          <FieldRow label="Goal">
            <Select
              value={brief.goal || ''}
              onChange={(e) => update('goal', e.currentTarget.value || undefined)}
            >
              <option value="">(none)</option>
              <option value="awareness">Awareness</option>
              <option value="acquisition">Acquisition</option>
              <option value="retention">Retention</option>
              <option value="upsell">Upsell</option>
              <option value="cart-recovery">Cart recovery</option>
            </Select>
          </FieldRow>

          <FieldRow label="Summary" required>
            <TextArea rows={4} value={brief.summary ?? ''} onChange={(e) => update('summary', e.currentTarget.value)} />
          </FieldRow>

          <FieldRow label="Offer">
            <TextArea
              rows={2}
              value={brief.offer ?? ''}
              onChange={(e) => update('offer', e.currentTarget.value)}
            />
            <Text size={0} muted>Also exposed as the Sanity-resolved {'{'}{'{'}offer.amount{'}'}{'}'} token.</Text>
          </FieldRow>

          <FieldRow label="Landing URL base">
            <TextInput
              value={brief.landingUrlBase ?? ''}
              onChange={(e) => update('landingUrlBase', e.currentTarget.value || undefined)}
              placeholder="https://www.att.com/promo/..."
            />
          </FieldRow>
        </Stack>
      </Card>

      <Card padding={4} radius={2} shadow={1}>
        <Stack space={4}>
          <SectionHeading title="Constraints" />
          <FieldRow label="Key messages">
            <StringArrayEditor
              value={brief.keyMessages || []}
              onChange={(v) => update('keyMessages', v)}
              placeholder="A must-include talking point…"
            />
          </FieldRow>
          <FieldRow label="Mandatory disclaimers">
            <StringArrayEditor
              value={brief.mandatoryDisclaimers || []}
              onChange={(v) => update('mandatoryDisclaimers', v)}
              placeholder="Legal copy verbatim…"
            />
          </FieldRow>
        </Stack>
      </Card>

      <Card padding={4} radius={2} shadow={1}>
        <Stack space={4}>
          <SectionHeading title="Targeting" />
          <FieldRow label="Target channels">
            <RefMultiselect
              options={config.channels.map((c) => ({_id: c._id, label: c.title || c.key}))}
              value={brief.targetChannels?.map((r) => r._ref) || []}
              onChange={(ids) => update('targetChannels', ids.map((_ref) => ({_ref})))}
            />
          </FieldRow>
          <FieldRow label="Target segments">
            <RefMultiselect
              options={config.segments.map((s) => ({_id: s._id, label: `${s.title || s.key} · ${s.brand || ''}`}))}
              value={brief.targetSegments?.map((r) => r._ref) || []}
              onChange={(ids) => update('targetSegments', ids.map((_ref) => ({_ref})))}
            />
          </FieldRow>
          <FieldRow label="Featured product">
            <Select
              value={brief.featuredProduct?._ref || ''}
              onChange={(e) =>
                update('featuredProduct', e.currentTarget.value ? {_ref: e.currentTarget.value} : (undefined as any))
              }
            >
              <option value="">(none — product.* tokens use external sample)</option>
              {config.products.map((p) => (
                <option key={p._id} value={p._id}>{p.name} · {p.price}</option>
              ))}
            </Select>
          </FieldRow>
        </Stack>
      </Card>

      {isAbandonedCart && (
        <Card padding={4} radius={2} shadow={1} tone="primary">
          <Stack space={4}>
            <Flex align="center" gap={2}>
              <SectionHeading title="Flow steps" />
              <Badge tone="primary">Abandoned cart</Badge>
            </Flex>
            <Text size={1} muted>Variations are generated per step × channel × segment.</Text>
            <FlowStepsEditor
              value={brief.flowSteps || []}
              onChange={(v) => update('flowSteps', v)}
              config={config}
            />
          </Stack>
        </Card>
      )}

      {generateOpen && (
        <GenerateDialog
          brief={brief}
          config={config}
          onClose={() => setGenerateOpen(false)}
          onOpenMatrix={() => {
            setGenerateOpen(false)
            onGenerated(brief._id.replace(/^drafts\./, ''))
          }}
        />
      )}
    </Stack>
  )
}

function SectionHeading({title}: {title: string}) {
  return <Heading size={1}>{title}</Heading>
}

function FieldRow({label, required, children}: {label: string; required?: boolean; children: React.ReactNode}) {
  return (
    <Stack space={2}>
      <Label size={1} muted>
        {label}{required && <span style={{color: '#dc2626', marginLeft: 4}}>*</span>}
      </Label>
      {children}
    </Stack>
  )
}

function StringArrayEditor({
  value, onChange, placeholder,
}: {value: string[]; onChange: (v: string[]) => void; placeholder?: string}) {
  const [draft, setDraft] = useState('')
  return (
    <Stack space={2}>
      <Flex gap={2}>
        <Box flex={1}>
          <TextInput
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim()) {
                e.preventDefault()
                onChange([...(value || []), draft.trim()])
                setDraft('')
              }
            }}
          />
        </Box>
        <Button
          text="Add"
          mode="ghost"
          disabled={!draft.trim()}
          onClick={() => {
            onChange([...(value || []), draft.trim()])
            setDraft('')
          }}
        />
      </Flex>
      {value && value.length > 0 && (
        <Stack space={1}>
          {value.map((v, i) => (
            <Flex key={i} align="center" gap={2}>
              <Box flex={1}>
                <Card padding={2} radius={1} tone="transparent" border>
                  <Text size={1}>{v}</Text>
                </Card>
              </Box>
              <Button
                text="Remove"
                mode="bleed"
                tone="critical"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              />
            </Flex>
          ))}
        </Stack>
      )}
    </Stack>
  )
}

function RefMultiselect({
  options, value, onChange,
}: {options: {_id: string; label: string}[]; value: string[]; onChange: (ids: string[]) => void}) {
  return (
    <Stack space={2}>
      {options.map((opt) => {
        const checked = value.includes(opt._id)
        return (
          <Flex key={opt._id} align="center" gap={2}>
            <Checkbox
              checked={checked}
              onChange={(e) => {
                if (e.currentTarget.checked) onChange([...value, opt._id])
                else onChange(value.filter((id) => id !== opt._id))
              }}
            />
            <Text size={1}>{opt.label}</Text>
          </Flex>
        )
      })}
    </Stack>
  )
}

function FlowStepsEditor({
  value, onChange, config,
}: {value: FlowStep[]; onChange: (v: FlowStep[]) => void; config: AppConfig}) {
  function updateStep(idx: number, patch: Partial<FlowStep>) {
    onChange(value.map((s, i) => (i === idx ? {...s, ...patch} : s)))
  }
  function removeStep(idx: number) {
    onChange(value.filter((_, i) => i !== idx))
  }
  function addStep() {
    onChange([
      ...value,
      {_key: `step-${Date.now().toString(36)}`, stepKey: '', delayLabel: '', intent: '', channels: []},
    ])
  }
  return (
    <Stack space={3}>
      {value.map((step, idx) => (
        <Card key={step._key || idx} padding={3} radius={2} border>
          <Stack space={3}>
            <Flex justify="space-between" align="center">
              <Inline space={2}>
                <Badge tone="primary">Step {idx + 1}</Badge>
                {step.stepKey && <Text size={1} weight="medium">{step.stepKey}</Text>}
              </Inline>
              <Button text="Remove" mode="bleed" tone="critical" onClick={() => removeStep(idx)} />
            </Flex>
            <Grid columns={[1, 2]} gap={3}>
              <Stack space={1}>
                <Label size={0} muted>Step key</Label>
                <TextInput
                  value={step.stepKey}
                  placeholder="reminder"
                  onChange={(e) => updateStep(idx, {stepKey: e.currentTarget.value})}
                />
              </Stack>
              <Stack space={1}>
                <Label size={0} muted>Delay</Label>
                <TextInput
                  value={step.delayLabel || ''}
                  placeholder="1 hour after abandon"
                  onChange={(e) => updateStep(idx, {delayLabel: e.currentTarget.value})}
                />
              </Stack>
            </Grid>
            <Stack space={1}>
              <Label size={0} muted>Intent</Label>
              <TextArea
                rows={2}
                value={step.intent || ''}
                onChange={(e) => updateStep(idx, {intent: e.currentTarget.value})}
              />
            </Stack>
            <Stack space={1}>
              <Label size={0} muted>Channels at this step</Label>
              <RefMultiselect
                options={config.channels.map((c) => ({_id: c._id, label: c.title || c.key}))}
                value={(step.channels || []).map((r) => r._ref)}
                onChange={(ids) => updateStep(idx, {channels: ids.map((_ref) => ({_ref}))})}
              />
            </Stack>
          </Stack>
        </Card>
      ))}
      <Button text="+ Add flow step" mode="ghost" onClick={addStep} />
    </Stack>
  )
}
