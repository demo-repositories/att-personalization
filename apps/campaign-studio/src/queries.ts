import {defineQuery} from 'groq'

/** All briefs + denormalized counts (uses sub-queries for the count). */
export const BRIEF_LIST_QUERY = defineQuery(`
  *[_type == "campaignBrief"] | order(_updatedAt desc) {
    _id, _rev, _updatedAt, title, slug, campaignType, summary, goal,
    "targetChannelCount": count(targetChannels),
    "targetSegmentCount": count(targetSegments),
    "flowStepCount": count(flowSteps),
    "generated": count(*[_type == "contentVariation" && brief._ref == ^._id && status == "generated"]),
    "total": count(*[_type == "contentVariation" && brief._ref == ^._id])
  }
`)

/** Single brief with all editable fields (raw — supports drafts.* too). */
export const BRIEF_DETAIL_QUERY = defineQuery(`
  *[_id == $id || _id == "drafts." + $id][0] {
    _id, _rev, _type, title, slug, campaignType, summary, goal, offer,
    keyMessages, mandatoryDisclaimers, targetChannels, targetSegments,
    landingUrlBase, featuredProduct, flowSteps
  }
`)

/** All variations attached to a brief (for the matrix view). */
export const MATRIX_QUERY = defineQuery(`
  *[_type == "contentVariation" && brief._ref == $briefId] {
    _id, _rev, flowStep, channel, segment, status, generatedAt,
    generatedFromBriefRev, brief,
    web, email, sms
  }
`)

/** Channel + segment + mergeField config (cached in app shell). */
export const CONFIG_QUERY = defineQuery(`{
  "channels": *[_type == "channel"] | order(order asc) { _id, key, title, constraints, maxLength },
  "segments": *[_type == "segment"] | order(_createdAt asc) { _id, key, title, brand, brandColor, brandVoice, audienceProfile },
  "mergeFields": *[_type == "mergeField"] { _id, key, source, sampleValue, sanityResolver, label },
  "products": *[_type == "product"] { _id, name, price }
}`)
