import {beforeEach, describe, expect, it, vi} from 'vitest'
import {generateMatrix} from './orchestrate'

// ─── Mock client (PRD Appendix E pattern; pure node, no jsdom) ────────────────

interface MockClient {
  created: any[]
  patched: Array<{id: string; set: Record<string, unknown>}>
  fetch: ReturnType<typeof vi.fn>
  createOrReplace: ReturnType<typeof vi.fn>
  patch: (id: string) => any
  delete: ReturnType<typeof vi.fn>
  withConfig: () => MockClient
  agent: {action: {generate: ReturnType<typeof vi.fn>}}
}

function createMockClient(brief: any): MockClient {
  const created: any[] = []
  const patched: Array<{id: string; set: Record<string, unknown>}> = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    created,
    patched,
    fetch: vi.fn(async () => brief),
    createOrReplace: vi.fn(async (doc: any) => {
      created.push(doc)
      return doc
    }),
    patch: (id: string) => ({
      set: (val: Record<string, unknown>) => ({
        commit: vi.fn(async () => {
          patched.push({id, set: val})
          return {}
        }),
      }),
    }),
    delete: vi.fn(async () => ({})),
    withConfig: () => client,
    agent: {action: {generate: vi.fn(async () => ({_id: 'generated'}))}},
  }
  return client
}

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const mergeFieldRegistry = [
  {key: 'product.name', source: 'external', sampleValue: 'iPhone 16 Pro', description: 'name'},
  {key: 'offer.amount', source: 'sanity', sanityResolver: 'offer', description: 'offer'},
]

function promoBrief() {
  return {
    _id: 'brief-spring5g',
    _rev: 'rev-promo-1',
    campaignType: 'promotional',
    offer: '$30/mo off',
    keyMessages: ['Save now'],
    mandatoryDisclaimers: ['Taxes apply'],
    targetChannels: [
      {_id: 'channel-web', key: 'web', title: 'Web', constraints: 'web rules'},
      {_id: 'channel-email', key: 'email', title: 'Email', constraints: 'email rules'},
      {_id: 'channel-sms', key: 'sms', title: 'SMS', constraints: 'sms rules'},
    ],
    targetSegments: [
      {_id: 'segment-new', key: 'new', title: 'New', brand: 'att', brandVoice: 'v', audienceProfile: 'p'},
      {_id: 'segment-loyal', key: 'loyal', title: 'Loyal', brand: 'att', brandVoice: 'v', audienceProfile: 'p'},
      {_id: 'segment-business', key: 'business', title: 'Business', brand: 'firstnet', brandVoice: 'v', audienceProfile: 'p'},
      {_id: 'segment-value', key: 'value', title: 'Value', brand: 'cricket', brandVoice: 'v', audienceProfile: 'p'},
    ],
    flowSteps: [],
    mergeFields: mergeFieldRegistry,
  }
}

function cartBrief() {
  const segments = promoBrief().targetSegments
  return {
    _id: 'brief-cart-recovery',
    _rev: 'rev-cart-1',
    campaignType: 'abandoned-cart',
    offer: '$10 off',
    featuredProduct: {_ref: 'product-iphone16pro'},
    targetChannels: [
      {_id: 'channel-email', key: 'email', title: 'Email', constraints: 'rules'},
      {_id: 'channel-sms', key: 'sms', title: 'SMS', constraints: 'rules'},
    ],
    targetSegments: segments,
    flowSteps: [
      {
        stepKey: 'reminder', delayLabel: '1 hour', intent: 'nudge',
        channels: [{_id: 'channel-email', key: 'email', title: 'Email', constraints: 'rules'}],
      },
      {
        stepKey: 'incentive', delayLabel: '24 hours', intent: 'sweeten',
        channels: [
          {_id: 'channel-email', key: 'email', title: 'Email', constraints: 'rules'},
          {_id: 'channel-sms', key: 'sms', title: 'SMS', constraints: 'rules'},
        ],
      },
      {
        stepKey: 'urgency', delayLabel: '48 hours', intent: 'last chance',
        channels: [
          {_id: 'channel-email', key: 'email', title: 'Email', constraints: 'rules'},
          {_id: 'channel-sms', key: 'sms', title: 'SMS', constraints: 'rules'},
        ],
      },
    ],
    mergeFields: mergeFieldRegistry,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('generateMatrix — promotional', () => {
  it('produces 12 cells (3 channels × 4 segments), all generated', async () => {
    const client = createMockClient(promoBrief())
    const cells = await generateMatrix(client as any, {briefId: 'brief-spring5g'})
    expect(cells).toHaveLength(12)
    expect(cells.every((c) => c.status === 'generated')).toBe(true)
    expect(cells.every((c) => c.flowStep === 'default')).toBe(true)
    expect(client.agent.action.generate).toHaveBeenCalledTimes(12)
    expect(client.createOrReplace).toHaveBeenCalledTimes(12)
  })

  it('is idempotent: second run produces the same id set', async () => {
    const client1 = createMockClient(promoBrief())
    const client2 = createMockClient(promoBrief())
    const first = await generateMatrix(client1 as any, {briefId: 'brief-spring5g'})
    const second = await generateMatrix(client2 as any, {briefId: 'brief-spring5g'})
    expect(new Set(first.map((c) => c.id))).toEqual(new Set(second.map((c) => c.id)))
    expect(first.length).toBe(second.length)
    // No duplicates within a single run
    expect(new Set(first.map((c) => c.id)).size).toBe(first.length)
  })

  it('records status:error on Generate throw and does NOT propagate', async () => {
    const client = createMockClient(promoBrief())
    client.agent.action.generate = vi.fn(async () => {
      throw new Error('vX rate limit')
    })
    const cells = await generateMatrix(client as any, {briefId: 'brief-spring5g'})
    expect(cells).toHaveLength(12)
    expect(cells.every((c) => c.status === 'error')).toBe(true)
    expect(cells.every((c) => c.error === 'vX rate limit')).toBe(true)
    // status:'error' patches landed
    const errorPatches = client.patched.filter((p) => (p.set as any).status === 'error')
    expect(errorPatches).toHaveLength(12)
  })

  it('fires onProgress with done/total/current', async () => {
    const client = createMockClient(promoBrief())
    const events: any[] = []
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      onProgress: (p) => events.push(p),
    })
    // 12 starts + 12 ends = 24 events
    expect(events).toHaveLength(24)
    const finalEvent = events[events.length - 1]
    expect(finalEvent.done).toBe(12)
    expect(finalEvent.total).toBe(12)
    expect(finalEvent.current).toMatchObject({channel: expect.any(String), segment: expect.any(String)})
  })

  it('honors channels/segments filter args', async () => {
    const client = createMockClient(promoBrief())
    const cells = await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['value'],
    })
    expect(cells).toHaveLength(1)
    expect(cells[0]!.channel).toBe('sms')
    expect(cells[0]!.segment).toBe('value')
    expect(cells[0]!.id).toBe('variation.brief-spring5g.default.sms.value')
  })

  it('throws if the brief is missing', async () => {
    const client = createMockClient(null)
    await expect(generateMatrix(client as any, {briefId: 'nope'})).rejects.toThrow(/not found/)
  })

  it('writes placeholders BEFORE the Generate call (the visible-progress contract)', async () => {
    const order: string[] = []
    const client = createMockClient(promoBrief())
    client.createOrReplace = vi.fn(async (doc: any) => {
      order.push('placeholder:' + doc._id)
      return doc
    })
    client.agent.action.generate = vi.fn(async () => {
      order.push('generate')
      return {}
    })
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['value'],
    })
    expect(order[0]).toMatch(/^placeholder:variation/)
    expect(order[1]).toBe('generate')
  })
})

describe('generateMatrix — abandoned-cart', () => {
  it('produces step.channels × segments cells per flowStep (1+2+2 × 4 = 20)', async () => {
    const client = createMockClient(cartBrief())
    const cells = await generateMatrix(client as any, {briefId: 'brief-cart-recovery'})
    expect(cells).toHaveLength(20)
    // step distribution
    const byStep = (k: string) => cells.filter((c) => c.flowStep === k).length
    expect(byStep('reminder')).toBe(4)
    expect(byStep('incentive')).toBe(8)
    expect(byStep('urgency')).toBe(8)
  })

  it('filters by step key', async () => {
    const client = createMockClient(cartBrief())
    const cells = await generateMatrix(client as any, {
      briefId: 'brief-cart-recovery',
      steps: ['reminder'],
    })
    expect(cells).toHaveLength(4)
    expect(cells.every((c) => c.flowStep === 'reminder')).toBe(true)
  })
})

describe('generateMatrix — agent target shape', () => {
  beforeEach(() => vi.clearAllMocks())

  it('web channel uses array target with heroImage.asset', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['web'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(Array.isArray(call.target)).toBe(true)
    expect(call.target).toEqual([{path: ['web']}, {path: ['web', 'heroImage', 'asset']}])
  })

  it('non-web channel uses single-object target', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(call.target).toEqual({path: ['sms']})
  })

  it('targetDocument uses operation:createOrReplace (regression: live API rejects "create" when placeholder exists)', async () => {
    // The orchestrate loop writes a `status:'generating'` placeholder at the deterministic _id
    // BEFORE calling Generate. If Generate is invoked with operation:'create', the live Sanity
    // API rejects with "document already exists" — caught in the pass-3 live smoke. The fix is
    // operation:'createOrReplace', which also makes the call self-idempotent on re-runs.
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(call.targetDocument.operation).toBe('createOrReplace')
    expect(call.targetDocument._id).toBe('variation.brief-spring5g.default.sms.new')
    expect(call.targetDocument._type).toBe('contentVariation')
  })
})
