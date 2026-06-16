# Sanity Seed — AT&T Multi-channel Personalization POC

**Pass 2 completed:** 2026-06-16  
**Seeded by:** @seed-lead  
**Sanity project:** `z6s0fz61` / dataset `production`  
**Studio:** https://att-personalization.sanity.studio/

---

## Channels (3 published)

| ID | key | title |
|---|---|---|
| `channel-web` | `web` | Web / landing page |
| `channel-email` | `email` | Email |
| `channel-sms` | `sms` | SMS / push |

---

## Segments (4 published, logos AI-generated ✅)

| ID | key | brand | brandColor | logo asset |
|---|---|---|---|---|
| `segment-new` | `new` | `att` | `#00A8E0` | `image-2c10616aa14a97969aad4e7bd8b2a0494e3fa41a-1408x768-jpg` |
| `segment-loyal` | `loyal` | `att` | `#00A8E0` | `image-1dc49c8a43801c015c8cb9b4d6ab92b4f883d5db-1408x768-jpg` |
| `segment-business` | `business` | `firstnet` | `#2B7A0B` | `image-96d3c2901bd7a1f2818cbf33f806ddefb20cc1b3-1408x768-jpg` |
| `segment-value` | `value` | `cricket` | `#80B82A` | `image-c3dbd9401b8893af084fc49832771b8aadb64d11-1408x768-jpg` |

---

## Merge Fields / Token Registry (6 published)

| ID | key | source | sampleValue | sanityResolver |
|---|---|---|---|---|
| `mergeField-product-name` | `product.name` | `external` | `iPhone 16 Pro` | `featuredProduct->name` |
| `mergeField-product-price` | `product.price` | `external` | `$29.99/mo` | `featuredProduct->price` |
| `mergeField-cart-recoveryUrl` | `cart.recoveryUrl` | `external` | `https://www.att.com/cart/abc123` | — |
| `mergeField-cart-itemCount` | `cart.itemCount` | `external` | `2` | — |
| `mergeField-customer-firstName` | `customer.firstName` | `external` | `Jordan` | — |
| `mergeField-offer-amount` | `offer.amount` | `sanity` | `$30/mo off` | `offer` |

> **Note:** `product.name` and `product.price` are `source: external` by default. When a brief has `featuredProduct` set, `tokens.ts` (pass 3) flips resolution to Sanity via the `sanityResolver` path. The registry's `sanityResolver` field is informational for that logic.

---

## Products (1 published, image AI-generated ✅)

| ID | name | price | image asset |
|---|---|---|---|
| `product-iphone16pro` | `iPhone 16 Pro` | `$29.99/mo` | `image-3003dc217fb2a097d14b18669eb10b98578886ca-1408x768-jpg` |

---

## Campaign Briefs (2 drafts — ready for editor review)

### Brief A — Promotional

| Field | Value |
|---|---|
| **ID** | `brief-spring5g` |
| **title** | Spring 5G Upgrade |
| **slug** | `spring-5g-upgrade` |
| **campaignType** | `promotional` |
| **goal** | `upsell` |
| **offer** | `$30/mo off for 12 months on a new line` |
| **targetChannels** | `channel-web`, `channel-email`, `channel-sms` |
| **targetSegments** | `segment-new`, `segment-loyal`, `segment-business`, `segment-value` |
| **landingUrlBase** | `https://www.att.com/promo/spring-5g` |

### Brief B — Abandoned Cart

| Field | Value |
|---|---|
| **ID** | `brief-cart-recovery` |
| **title** | Cart Recovery — Phone Upgrade |
| **slug** | `cart-recovery-phone-upgrade` |
| **campaignType** | `abandoned-cart` |
| **goal** | `cart-recovery` |
| **offer** | `$10 off when you complete checkout today` |
| **featuredProduct** | `product-iphone16pro` (triggers Sanity-resolved `{{product.*}}` tokens) |
| **targetChannels** | `channel-email`, `channel-sms` |
| **targetSegments** | `segment-new`, `segment-loyal`, `segment-business`, `segment-value` |

#### Flow Steps (Brief B)

| stepKey | delayLabel | intent | channels |
|---|---|---|---|
| `reminder` | 1 hour after abandon | Friendly nudge — you left this in your cart | `channel-email` |
| `incentive` | 24 hours | Sweeten with the $10 offer | `channel-email`, `channel-sms` |
| `urgency` | 48 hours | Last chance — limited stock + offer expiring | `channel-email`, `channel-sms` |

---

## GROQ Verification (run 2026-06-16)

```groq
// Published counts
{"channel": count(*[_type=="channel"]), "segment": count(*[_type=="segment"]), "mergeField": count(*[_type=="mergeField"]), "product": count(*[_type=="product"]), "campaignBrief": count(*[_type=="campaignBrief"])}
// → {"channel": 3, "segment": 4, "mergeField": 6, "product": 1, "campaignBrief": 0}
// (briefs are drafts — raw perspective shows campaignBrief: 2)

// Brief B spot-check
*[_type=="campaignBrief" && campaignType=="abandoned-cart"][0]{
  title, offer, "featuredProductId": featuredProduct._ref,
  "steps": flowSteps[]{stepKey, delayLabel, intent, "channelCount": count(channels)}
}
// → 3 steps: reminder(1ch) → incentive(2ch) → urgency(2ch), featuredProductId: "product-iphone16pro"
```

---

## Notes for Pass 3 (@ai-core-lead)

- All config doc IDs above are stable and published — safe to reference in `tokens.ts` and `promptAssembly.ts`
- `offer.amount` token resolves from `brief.offer` field (source: `sanity`, resolver: `offer`)
- `product.name` / `product.price` flip to Sanity when `brief.featuredProduct` is set — check `brief.featuredProduct._ref` and dereference `product-iphone16pro`
- Briefs are drafts — AI generation works on drafts via `target.documentId`
- Schema deployed at `_.schemas.default` — validate against it before any Generate call
