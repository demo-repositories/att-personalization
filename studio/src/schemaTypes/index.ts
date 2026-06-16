import {campaignBrief} from './documents/campaignBrief'
import {channel} from './documents/channel'
import {segment} from './documents/segment'
import {mergeField} from './documents/mergeField'
import {product} from './documents/product'
import {contentVariation} from './documents/contentVariation'

import {flowStep} from './objects/flowStep'
import {webContent} from './objects/webContent'
import {emailContent} from './objects/emailContent'
import {smsContent} from './objects/smsContent'

export const schemaTypes = [
  // Documents
  campaignBrief,
  channel,
  segment,
  mergeField,
  product,
  contentVariation,
  // Objects
  flowStep,
  webContent,
  emailContent,
  smsContent,
]
