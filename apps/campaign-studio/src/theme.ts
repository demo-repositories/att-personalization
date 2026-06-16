import {buildTheme} from '@sanity/ui/theme'

/**
 * AT&T brand theme. Using @sanity/ui default theme — pass 7 may swap in
 * brand font + palette overrides once the woff2 lands. The default already
 * gives us Inter / system fallbacks that match the placeholder in fonts.css.
 */
export const theme = buildTheme()
