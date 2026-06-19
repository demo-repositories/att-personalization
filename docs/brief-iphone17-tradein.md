# Campaign Brief — iPhone 17 Pro Trade-In Event (Promotional)

**Type:** Single-step (promotional) · `multiStep: false`
**Drafted:** 2026-06-17
**Source offer:** AT&T iPhone deals — up to $1,100 off iPhone 17 Pro / Pro Max with eligible trade-in on a qualifying premium unlimited plan ([att.com/deals/iphone-deals](https://www.att.com/deals/iphone-deals/), [att.com/deals/phone-trade-in](https://www.att.com/deals/phone-trade-in/)).

---

## Overview

A one-shot promotional push for AT&T's flagship trade-in offer: trade an eligible smartphone and get up to **$1,100 off** the iPhone 17 Pro or Pro Max (or up to **$700** off iPhone Air / 17) as bill credits over 36 months, with activation on a qualifying unlimited plan. Single send per channel × segment — no flow steps.

---

## Brief fields

| Field | Value |
|---|---|
| **Suggested ID** | `brief-iphone17-tradein` |
| **title** | iPhone 17 Pro Trade-In Event |
| **slug** | `iphone-17-pro-trade-in-event` |
| **multiStep** | `false` |
| **goal** | `upsell` |
| **offer** | `Up to $1,100 off iPhone 17 Pro or Pro Max with eligible trade-in on AT&T Premium 2.0 (or higher) — applied as bill credits over 36 months.` |
| **targetChannels** | `channel-web`, `channel-email`, `channel-sms` |
| **targetSegments** | `segment-new`, `segment-loyal`, `segment-business`, `segment-value` |
| **landingUrlBase** | `https://www.att.com/deals/iphone-deals/` |
| **featuredProduct** | _(unset — see note)_ |
| **allowedMedia** | Required for the `web` channel — attach at least one hero asset from the Media library before generating. |

---

## Summary (for the `summary` field)

> Drive upgrades and new-line activations around AT&T's headline trade-in offer. Trade in an eligible smartphone (valued $290+ after assessment) and get up to $1,100 off iPhone 17 Pro or Pro Max as bill credits over 36 months on AT&T Premium 2.0 or higher. Position the iPhone 17 Pro's camera and Apple-silicon performance alongside AT&T's nationwide 5G. One coordinated send across web, email, and SMS, tuned per audience segment.

---

## Key messages

- Up to **$1,100 off** iPhone 17 Pro / Pro Max with eligible trade-in; up to **$700** off iPhone Air / 17.
- Credits apply over **36 months** on a qualifying AT&T unlimited plan (Premium 2.0, Elite 2.0, or qualifying legacy plans).
- Trade-in is **easy and contactless** — check your device's value online, keep your number, switch in minutes.
- Backed by AT&T **nationwide 5G** coverage.

## Mandatory disclaimers (verbatim legal lines)

- _Req's purchase of an eligible device on a qualifying installment plan and activation on a qualifying AT&T unlimited plan (AT&T Premium 2.0 or higher). Well-qualified customers. Trade-in device must be in good condition and valued at $290+ after assessment. Up to $1,100 applied as bill credits over 36 mos; credits start within 3 bills. If service is cancelled, remaining device balance is due. Limited-time offer; subject to change._
- _AT&T 5G requires a compatible plan and device. 5G not available everywhere. Coverage and speeds may vary._

---

## Targeting rationale

| Segment | Brand | Angle |
|---|---|---|
| `segment-new` | AT&T | "Switch to AT&T and trade in to save" — acquisition framing. |
| `segment-loyal` | AT&T | "Reward your loyalty — upgrade and keep your number." |
| `segment-business` | FirstNet | "Upgrade your team's devices" — fleet/business framing. |
| `segment-value` | Cricket | Lighter trade-in framing toward value-tier devices and budgets. |

All three channels carry the same send (no sequence). Web is the rich hero landing experience; email mirrors it; SMS is the short nudge with the trade-in link.

## Tokens in play

| Token | Source | Use |
|---|---|---|
| `{{customer.firstName}}` | external | Personalize the opener. |
| `{{offer.amount}}` | sanity (`offer`) | Renders the offer line from the `offer` field. |

> **Note on `featuredProduct`:** the seeded product is `product-iphone16pro`. Leaving `featuredProduct` unset keeps `{{product.*}}` on the external sample. For accurate "iPhone 17 Pro" `{{product.name}}` / `{{product.price}}` tokens, seed a `product-iphone17pro` document and set `featuredProduct` to it. The brief copy references the iPhone 17 Pro directly so it reads correctly regardless.
