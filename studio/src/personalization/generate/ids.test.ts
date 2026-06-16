import {describe, expect, it} from 'vitest'
import {parseVariationId, variationId} from './ids'

describe('variationId', () => {
  it('is deterministic for the same inputs', () => {
    const a = variationId('brief-spring5g', 'default', 'sms', 'value')
    const b = variationId('brief-spring5g', 'default', 'sms', 'value')
    expect(a).toBe(b)
    expect(a).toBe('variation.brief-spring5g.default.sms.value')
  })

  it('strips drafts. prefix from brief id', () => {
    const a = variationId('drafts.brief-spring5g', 'default', 'web', 'new')
    expect(a).toBe('variation.brief-spring5g.default.web.new')
  })

  it('encodes step + channel + segment', () => {
    const id = variationId('brief-cart-recovery', 'incentive', 'email', 'loyal')
    expect(id).toBe('variation.brief-cart-recovery.incentive.email.loyal')
  })

  it('round-trips through parseVariationId', () => {
    const id = variationId('brief-cart-recovery', 'urgency', 'sms', 'business')
    const parsed = parseVariationId(id)
    expect(parsed).toEqual({
      briefId: 'brief-cart-recovery',
      stepKey: 'urgency',
      channelKey: 'sms',
      segmentKey: 'business',
    })
  })

  it('parseVariationId throws on malformed id', () => {
    expect(() => parseVariationId('nope')).toThrow()
    expect(() => parseVariationId('variation.too.short')).toThrow()
  })
})
