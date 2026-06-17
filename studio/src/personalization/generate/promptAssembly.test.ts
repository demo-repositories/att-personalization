import {describe, expect, it} from 'vitest'
import {buildPrompt} from './promptAssembly'
import type {BuildPromptArgs} from './promptAssembly'

const channel = {key: 'sms' as const, title: 'SMS / push', constraints: '<=160 chars, one link, include Txt STOP to opt out, no emojis'}
const webChannel = {key: 'web' as const, title: 'Web / landing page', constraints: 'Hero headline + body + CTA'}
const segment = {
  key: 'value',
  title: 'Value / prepaid (Cricket)',
  brand: 'cricket',
  brandVoice: 'Playful and value-forward',
  audienceProfile: 'Budget-conscious prepaid customers',
  brandDisclaimers: ['Cricket: Some legal line'],
}
const brief = {
  _id: 'brief-spring5g',
  _rev: 'rev1',
  offer: '$30/mo off for 12 months',
  keyMessages: ['Save now', '5G nationwide'],
  mandatoryDisclaimers: ['Taxes & fees apply.'],
}
const mergeFields = [
  {key: 'product.name', description: 'The product name'},
  {key: 'offer.amount', description: 'The current offer'},
]
const allowedMedia = [
  {_id: 'media-1', title: 'Hero A', assetRef: 'image-abc', description: 'Family outdoors'},
]

function basePromo(): BuildPromptArgs {
  return {brief, channel, segment, mergeFields}
}

describe('buildPrompt', () => {
  it('promotional shape — assignHeroFromMedia false for SMS, empty flowStepLine', () => {
    const out = buildPrompt(basePromo())
    expect(out.assignHeroFromMedia).toBe(false)
    expect(out.instructionParams.flowStepLine).toEqual({type: 'constant', value: ''})
  })

  it('assignHeroFromMedia is true for web when allowed media is attached', () => {
    const sms = buildPrompt(basePromo())
    const web = buildPrompt({
      ...basePromo(),
      channel: webChannel,
      brief: {...brief, allowedMedia},
    })
    expect(sms.assignHeroFromMedia).toBe(false)
    expect(web.assignHeroFromMedia).toBe(true)
    expect(sms.instruction).not.toMatch(/allowed media/i)
    expect(web.instruction).toMatch(/Do NOT generate or invent hero images/i)
    expect(web.instructionParams.allowedMedia?.value).toContain('image-abc')
  })

  it('web without allowed media forbids hero image generation', () => {
    const web = buildPrompt({...basePromo(), channel: webChannel})
    expect(web.assignHeroFromMedia).toBe(false)
    expect(web.instruction).toMatch(/Do NOT set or generate a hero image/i)
  })

  it('passes the brief by document reference, not embedded fields', () => {
    const out = buildPrompt(basePromo())
    expect(out.instructionParams.brief).toEqual({type: 'document', documentId: 'brief-spring5g'})
  })

  it('renders the token registry as {{key}} — description lines in instructionParams.tokens', () => {
    const out = buildPrompt(basePromo())
    const tokens = out.instructionParams.tokens
    expect(tokens).toEqual({
      type: 'constant',
      value: '{{product.name}} — The product name\n{{offer.amount}} — The current offer',
    })
  })

  it('combines brief + segment disclaimers via constant', () => {
    const out = buildPrompt(basePromo())
    expect(out.instructionParams.disclaimers).toEqual({
      type: 'constant',
      value: 'Taxes & fees apply.\nCricket: Some legal line',
    })
  })

  it('abandoned-cart adds flowStepLine populated by step intent', () => {
    const out = buildPrompt({
      ...basePromo(),
      step: {stepKey: 'incentive', delayLabel: '24 hours', intent: 'Sweeten with the offer'},
    })
    expect(out.instructionParams.flowStepLine).toEqual({
      type: 'constant',
      value: 'This is the "incentive" step (24 hours). Intent: Sweeten with the offer',
    })
  })

  it('does NOT inline variable content into the instruction string', () => {
    const out = buildPrompt(basePromo())
    expect(out.instruction).not.toContain('$30/mo off for 12 months')
    expect(out.instruction).toContain('$offer')
    expect(out.instruction).toContain('$brief')
    expect(out.instruction).toContain('$tokens')
  })

  it('maps brand keys to display names', () => {
    const out = buildPrompt(basePromo())
    expect(out.instructionParams.brand).toEqual({type: 'constant', value: 'Cricket'})
  })
})
