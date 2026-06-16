/** Shared cross-view types (Sanity-projection shapes used by the matrix + brief list). */

export type CampaignType = 'promotional' | 'abandoned-cart'
export type ChannelKey = 'web' | 'email' | 'sms'
export type SegmentKey = 'new' | 'loyal' | 'business' | 'value'
export type CellStatus = 'pending' | 'generating' | 'generated' | 'error'

export interface ChannelDoc {
  _id: string
  key: ChannelKey
  title?: string
  constraints?: string
  maxLength?: number
}

export interface SegmentDoc {
  _id: string
  key: SegmentKey
  title?: string
  brand?: string
  brandColor?: string
  brandVoice?: string
  audienceProfile?: string
}

export interface FlowStep {
  _key?: string
  stepKey: string
  delayLabel?: string
  intent?: string
  channels?: Array<{_ref: string}>
}

export interface CampaignBrief {
  _id: string
  _rev?: string
  _type: 'campaignBrief'
  title?: string
  slug?: {current?: string}
  campaignType: CampaignType
  summary?: string
  goal?: string
  offer?: string
  keyMessages?: string[]
  mandatoryDisclaimers?: string[]
  targetChannels?: Array<{_ref: string}>
  targetSegments?: Array<{_ref: string}>
  landingUrlBase?: string
  featuredProduct?: {_ref: string}
  flowSteps?: FlowStep[]
}

export interface MergeFieldDoc {
  _id: string
  key: string
  source: 'external' | 'sanity'
  sampleValue?: string
  sanityResolver?: string
  label?: string
}

export interface VariationCell {
  _id: string
  _rev?: string
  flowStep?: string
  channel?: ChannelKey
  segment?: SegmentKey
  status?: CellStatus
  generatedAt?: string
  generatedFromBriefRev?: string
  briefRef?: {_ref: string}
  web?: {
    headline?: string
    subheadline?: string
    ctaLabel?: string
    ctaUrl?: string
  }
  email?: {
    subjectLine?: string
    preheader?: string
    ctaLabel?: string
    ctaUrl?: string
  }
  sms?: {
    message?: string
    link?: string
  }
}
