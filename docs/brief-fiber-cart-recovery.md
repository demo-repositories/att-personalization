# Campaign Brief — AT&T Fiber Order Recovery (Abandoned Cart)

**Type:** Multi-step flow · `multiStep: true`
**Drafted:** 2026-06-17
**Source offer:** AT&T Fiber — $200 reward card when you order online; 99% reliability and symmetrical (equal upload/download) speeds ([att.com/deals](https://www.att.com/deals/)).

---

## Overview

A timed recovery sequence for prospects who **started an AT&T Fiber order online but didn't finish**. The hook is the **$200 AT&T Visa Reward Card** for completing the order online, reinforced by Fiber's symmetrical speeds and 99% reliability. Three escalating touches — gentle reminder, value reinforcement, then urgency — across email and SMS.

---

## Brief fields

| Field | Value |
|---|---|
| **Suggested ID** | `brief-fiber-cart-recovery` |
| **title** | AT&T Fiber Order Recovery |
| **slug** | `att-fiber-order-recovery` |
| **multiStep** | `true` |
| **goal** | `cart-recovery` |
| **offer** | `$200 AT&T Visa Reward Card when you complete your AT&T Fiber order online.` |
| **targetChannels** | `channel-email`, `channel-sms` |
| **targetSegments** | `segment-new`, `segment-loyal` |
| **landingUrlBase** | `https://www.att.com/internet/fiber/` |
| **featuredProduct** | _(unset — Fiber is a service, not a device SKU)_ |

> **Segment note:** Fiber is residential AT&T-brand internet, so this brief targets `segment-new` (switchers) and `segment-loyal` (existing AT&T wireless adding Fiber to bundle and save). `segment-business` (FirstNet) and `segment-value` (Cricket) are intentionally excluded — neither sells AT&T Fiber.

---

## Summary (for the `summary` field)

> Recover prospects who began an AT&T Fiber order online and dropped off before completing. Bring them back with the $200 reward-card incentive, reinforced by Fiber's equal upload/download speeds and 99% reliability. Existing AT&T wireless customers also save by bundling. A three-step email + SMS sequence that nudges, reinforces value, then creates urgency before the offer lapses.

---

## Key messages

- Finish your order online and get a **$200 AT&T Visa Reward Card**.
- AT&T Fiber: **equal upload & download speeds** and **99% reliability**.
- Already an AT&T wireless customer? **Bundle Fiber and save** on your internet bill.
- You're almost done — your plan and address are saved; pick up where you left off.

## Mandatory disclaimers (verbatim legal lines)

- _$200 AT&T Visa Reward Card: requires online order and installation of a qualifying AT&T Fiber plan. Reward card delivered within 8 weeks after installation; card issued by a bank under license and subject to cardholder terms. Limited availability in select areas._
- _Prices exclude taxes & fees and are subject to change. Speeds may vary. 99% reliability based on network availability; not a guarantee of uninterrupted service._

---

## Flow steps

| # | stepKey | delayLabel | intent | channels |
|---|---|---|---|---|
| 1 | `reminder` | 1 hour after abandon | Friendly nudge — your AT&T Fiber order is saved and waiting. | `channel-email` |
| 2 | `value` | 24 hours | Reinforce the $200 reward card + symmetrical speeds, 99% reliability, and bundle savings. | `channel-email`, `channel-sms` |
| 3 | `urgency` | 72 hours | Last chance — your $200 reward-card offer is expiring; complete your order today. | `channel-email`, `channel-sms` |

---

## Tokens in play

| Token | Source | Use |
|---|---|---|
| `{{customer.firstName}}` | external | Personalize the opener. |
| `{{cart.recoveryUrl}}` | external | Deep link back to the saved Fiber order. |
| `{{offer.amount}}` | sanity (`offer`) | Renders the $200 reward-card line from the `offer` field. |

> `{{cart.itemCount}}` is available but less relevant for a single Fiber plan; omit unless the order includes add-ons (e.g. AT&T All-Fi gateway, additional lines).

---

## How this maps to the matrix

With `multiStep: true`, the generation matrix renders **one grid per flow step** (segment × channel):

- Step 1 `reminder` → 2 segments × 1 channel (email) = 2 cells
- Step 2 `value` → 2 segments × 2 channels = 4 cells
- Step 3 `urgency` → 2 segments × 2 channels = 4 cells

**Total: 10 variations.**
