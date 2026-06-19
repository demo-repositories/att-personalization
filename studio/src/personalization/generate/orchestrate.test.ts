import {beforeEach, describe, expect, it, vi} from 'vitest'
import {generateMatrix} from './orchestrate'

// ─── Mock client (PRD Appendix E pattern; pure node, no jsdom) ────────────────

interface MockClient {
  created: any[]
  patched: Array<{id: string; set?: Record<string, unknown>; unset?: string[]}>
  actions: any[]
  fetch: ReturnType<typeof vi.fn>
  createOrReplace: ReturnType<typeof vi.fn>
  patch: (id: string) => any
  action: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  withConfig: () => MockClient
  releases: {create: ReturnType<typeof vi.fn>}
  agent: {action: {generate: ReturnType<typeof vi.fn>}}
}

/** Version documents written into the release via the Actions API. */
function versionCreateDocs(client: MockClient): any[] {
  return client.actions
    .filter((a) => a.actionType === 'sanity.action.document.version.create')
    .map((a) => a.document)
}

function createMockClient(brief: any): MockClient {
  const created: any[] = []
  const patched: Array<{id: string; set?: Record<string, unknown>; unset?: string[]}> = []
  const actions: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client: any = {
    created,
    patched,
    actions,
    fetch: vi.fn(async (query: string) => {
      if (brief === null) return null
      // resolveBriefReleaseId probes for an existing release pointer + state;
      // returning null forces a fresh release to be created. Match the probe
      // queries specifically so the main BRIEF_QUERY (which also projects the
      // generationReleaseId field) still returns the brief.
      const q = typeof query === 'string' ? query.trim() : ''
      if (q.endsWith('.generationReleaseId')) return null
      if (q.includes('releases::all')) return null
      return brief
    }),
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
      unset: (keys: string[]) => ({
        commit: vi.fn(async () => {
          patched.push({id, unset: keys})
          return {}
        }),
      }),
    }),
    action: vi.fn(async (a: any) => {
      actions.push(a)
      return {}
    }),
    delete: vi.fn(async () => ({})),
    withConfig: () => client,
    releases: {create: vi.fn(async () => ({releaseId: 'rTEST'}))},
    agent: {
      action: {
        generate: vi.fn(async (opts: any) => ({
          _id: opts?.targetDocument?._id ?? 'generated',
          _type: 'contentVariation',
        })),
      },
    },
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
    multiStep: false,
    offer: '$30/mo off',
    keyMessages: ['Save now'],
    mandatoryDisclaimers: ['Taxes apply'],
    allowedMedia: [
      {_id: 'media-hero-a', title: '5G hero', assetRef: 'image-hero-a', alt: '5G family'},
      {_id: 'media-hero-b', title: 'Device hero', assetRef: 'image-hero-b', alt: 'Phone'},
    ],
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
    multiStep: true,
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
  it('produces 12 cells (3 channels × 4 segments), all generated into the release', async () => {
    const client = createMockClient(promoBrief())
    const {cells, releaseId} = await generateMatrix(client as any, {briefId: 'brief-spring5g'})
    expect(cells).toHaveLength(12)
    expect(cells.every((c) => c.status === 'generated')).toBe(true)
    expect(cells.every((c) => c.flowStep === 'default')).toBe(true)
    expect(client.agent.action.generate).toHaveBeenCalledTimes(12)
    // Each cell is written as a version document into the release (not published).
    expect(releaseId).toBe('rTEST')
    expect(versionCreateDocs(client)).toHaveLength(12)
    expect(versionCreateDocs(client).every((d) => d._id.startsWith('versions.rTEST.'))).toBe(true)
  })

  it('is idempotent: second run produces the same id set', async () => {
    const client1 = createMockClient(promoBrief())
    const client2 = createMockClient(promoBrief())
    const first = (await generateMatrix(client1 as any, {briefId: 'brief-spring5g'})).cells
    const second = (await generateMatrix(client2 as any, {briefId: 'brief-spring5g'})).cells
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
    const {cells} = await generateMatrix(client as any, {briefId: 'brief-spring5g'})
    expect(cells).toHaveLength(12)
    expect(cells.every((c) => c.status === 'error')).toBe(true)
    expect(cells.every((c) => c.error === 'vX rate limit')).toBe(true)
    // Failed cells write NO version — the release only holds successful generations.
    expect(versionCreateDocs(client)).toHaveLength(0)
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
    const {cells} = await generateMatrix(client as any, {
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

  it('generates (noWrite) before writing the release version', async () => {
    const order: string[] = []
    const client = createMockClient(promoBrief())
    client.agent.action.generate = vi.fn(async (opts: any) => {
      order.push('generate')
      return {_id: opts?.targetDocument?._id, _type: 'contentVariation'}
    })
    const baseAction = client.action
    client.action = vi.fn(async (a: any) => {
      order.push('action:' + a.actionType)
      return baseAction(a)
    })
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['value'],
    })
    expect(order[0]).toBe('generate')
    expect(order[1]).toMatch(/^action:sanity\.action\.document\.version/)
  })
})

describe('generateMatrix — multi-step', () => {
  it('produces step.channels × segments cells per flowStep (1+2+2 × 4 = 20)', async () => {
    const client = createMockClient(cartBrief())
    const {cells} = await generateMatrix(client as any, {briefId: 'brief-cart-recovery'})
    expect(cells).toHaveLength(20)
    // step distribution
    const byStep = (k: string) => cells.filter((c) => c.flowStep === k).length
    expect(byStep('reminder')).toBe(4)
    expect(byStep('incentive')).toBe(8)
    expect(byStep('urgency')).toBe(8)
  })

  it('filters by step key', async () => {
    const client = createMockClient(cartBrief())
    const {cells} = await generateMatrix(client as any, {
      briefId: 'brief-cart-recovery',
      steps: ['reminder'],
    })
    expect(cells).toHaveLength(4)
    expect(cells.every((c) => c.flowStep === 'reminder')).toBe(true)
  })
})

describe('generateMatrix — agent target shape', () => {
  beforeEach(() => vi.clearAllMocks())

  it('web channel target excludes heroImage (no AI asset generation)', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['web'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(call.target).toEqual({path: ['web'], exclude: ['heroImage']})
  })

  it('assigns the allowed media hero image on the release version', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['web'],
      segments: ['new'],
    })
    const heroDoc = versionCreateDocs(client).find((d) => d.web?.heroImage)
    expect(heroDoc).toBeDefined()
    expect(heroDoc.web.heroImage).toMatchObject({
      _type: 'image',
      asset: {_type: 'reference', _ref: expect.stringMatching(/^image-hero-/)},
    })
  })

  it('assigns a Media Library URL asset as the hero (no assetRef)', async () => {
    const brief = {
      ...promoBrief(),
      allowedMedia: [
        {
          _id: 'media-ml-x',
          title: 'connect-multiple-devices.jpg',
          url: 'https://cdn.sanity.io/media-libraries/ml123/images/abc-800x501.jpg',
        },
      ],
    }
    const client = createMockClient(brief)
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['web'],
      segments: ['new'],
    })
    const heroDoc = versionCreateDocs(client).find((d) => d.web?.heroImage)
    expect(heroDoc).toBeDefined()
    expect(heroDoc.web.heroImage).toMatchObject({
      _type: 'image',
      url: 'https://cdn.sanity.io/media-libraries/ml123/images/abc-800x501.jpg',
    })
  })

  it('web without allowed media generates text and skips the hero image', async () => {
    const brief = {...promoBrief(), allowedMedia: []}
    const client = createMockClient(brief)
    const {cells} = await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['web'],
      segments: ['new'],
    })
    // No longer an error: copy is generated, the hero image is simply skipped.
    expect(cells[0]!.status).toBe('generated')
    expect(client.agent.action.generate).toHaveBeenCalled()
    expect(versionCreateDocs(client).every((d) => !d.web?.heroImage)).toBe(true)
  })

  it('non-web channel target excludes heroImage', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(call.target).toEqual({path: ['sms'], exclude: ['heroImage']})
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

  it('uses noWrite so Generate never mutates published content', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    const call = client.agent.action.generate.mock.calls[0]![0]
    expect(call.noWrite).toBe(true)
  })
})

describe('generateMatrix — content release', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a release and stores the pointer on the brief', async () => {
    const client = createMockClient(promoBrief())
    const {releaseId} = await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    expect(releaseId).toBe('rTEST')
    expect(client.releases.create).toHaveBeenCalledTimes(1)
    // Pointer written to both published + draft editions of the brief.
    const pointerWrites = client.patched.filter(
      (p) => (p.set as any)?.generationReleaseId === 'rTEST',
    )
    expect(pointerWrites.map((p) => p.id)).toEqual(
      expect.arrayContaining(['brief-spring5g', 'drafts.brief-spring5g']),
    )
  })

  it('writes version documents carrying generated status + brief rev', async () => {
    const client = createMockClient(promoBrief())
    await generateMatrix(client as any, {
      briefId: 'brief-spring5g',
      channels: ['sms'],
      segments: ['new'],
    })
    const docs = versionCreateDocs(client)
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      _id: 'versions.rTEST.variation.brief-spring5g.default.sms.new',
      _type: 'contentVariation',
      status: 'generated',
      channel: 'sms',
      segment: 'new',
    })
  })
})
