# Search identity and publisher-logo verification

## Implemented

The homepage now provides one `WebSite` node named Folkly and one linked
`Organization` node. The organization identifies Then Media inc. as its parent
and references a dedicated 512×512 Folkly logo at
`/assets/folkly-logo-512.png`. The same organization identifier and logo are used
inside every Article publisher object. The homepage HTML title now reads
`Folkly | Stories at the Intersection of Culture and Place`, and its Open Graph
title/site name use the same identity.

This change does not recast editorial personas as people. Visible bylines and the
existing `Folkly editorial` Organization author remain intact. Article H1s,
prose, dates, public catalog entries, images, credits and licenses are unchanged.

## Evidence

- The raster logo is 512×512 pixels, has an opaque high-contrast background and
  remains legible against white.
- `npm run build` generated 73 public routes and copied the logo into the public
  asset directory.
- Structured-data fixtures verified the homepage graph, linked organization IDs,
  publisher logo URL/dimensions, exact homepage title, Open Graph site name, and
  all 11 Article objects.
- `npm test` passed the full debug, security, reader, newsletter, privacy,
  editorial and storage regression suite.

The implementation deployed successfully. At 2026-10-09 00:41 UTC, production
served the exact homepage title and linked Folkly WebSite/Organization graph.
The New Orleans Article publisher referenced the same organization and logo.
The logo returned 200 as `image/png`, contained 14,042 bytes, and matched the
reviewed SHA-256
`180c88648e74e131f23892174505d0e12dd5c77326870cabe591e9f090435658`.

## Limits

Search engines choose displayed site names and logos algorithmically. Rich Results
and Search Console validation, indexing and recrawl remain external acceptance
steps. No ranking or rich-result change is claimed from markup alone.

Primary guidance checked October 8, 2026:

- https://developers.google.com/search/docs/appearance/structured-data/organization
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/appearance/structured-data/article
