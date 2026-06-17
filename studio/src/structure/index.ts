import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      S.documentTypeListItem('campaignBrief').title('Campaign briefs'),
      S.documentTypeListItem('contentVariation').title('Variations'),
      S.divider(),
      S.listItem()
        .title('Media library')
        .child(S.documentTypeList('mediaAsset').title('Media assets')),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) =>
          !['campaignBrief', 'contentVariation', 'mediaAsset'].includes(item.getId() ?? ''),
      ),
    ])
