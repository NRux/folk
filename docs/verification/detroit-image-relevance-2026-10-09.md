# Detroit image relevance correction

## Outcome

The Detroit story now has a responsive cover in the journal stream and article.
The cover shows Juan Atkins, Derrick May and Kevin Saunderson performing together
as the Belleville Three at the Detroit Masonic Temple in 2017.

Three Love Parade photographs from Berlin and the distant 2026 waterfront view
of Movement were removed. They were replaced with:

1. the WGPR broadcast building in Detroit, beside the discussion of the
   Electrifying Mojo's radio circulation;
2. the Belleville Three performing together in Detroit;
3. Juan Atkins performing as Model 500 before a Detroit audience; and
4. the Detroit Electronic Music Festival main stage in 2002, without unrelated
   boats or waterfront foreground.

The story now names the Detroit Electronic Music Festival and its later Movement
name using the Detroit Historical Society as a third source. This establishes the
specific event connection for the retained festival photographs without implying
that later images depict the genre's 1980s beginnings.

## Root cause and prevention

The earlier sequence validator checked group priority, repeated instruments and
adjacent subject variety. It did not require an image's place, named event,
visible subject or paragraph placement to support the story. Accurate captions
therefore prevented mislabeling but did not prevent irrelevant images.

`scripts/image-relevance.mjs` and `web/vercel/image-relevance.json` now enforce a
12-point review across geography, subject, paragraph placement and visible
prominence. Eight points are required. An image fails regardless of score when:

- it shows a location outside the article;
- it shows a specific event not named in the story;
- the claimed subject is only incidental in the frame;
- its identity or two-paragraph placement does not match the manifest; or
- the review/evidence record is missing.

Detroit is fully reviewed under the new gate. Any story published after October
9, 2026 fails closed unless it has a complete cover and inline relevance policy.
The existing ten other stories remain published under their prior evidence and
can be migrated through normal editorial review rather than silently rewritten.

## Source and rights evidence

Wikimedia Commons metadata and the decoded image bytes were checked separately.
The exact page IDs, preview dimensions, byte counts and SHA-256 digests are in
`detroit-image-source-review-2026-10-09.json`. Creator and license links remain
visible in the story and the image-credit index. The article's new festival
history statement uses:

- Detroit Historical Society, [Detroit Electronic Music Festival (Movement)](https://www.detroithistorical.org/learn/online-research/encyclopedia-of-detroit/detroit-electronic-music-festival-movement)

## Verification

- Offline build: 72 public pages and eleven existing published stories.
- Full regression: all 32 commands passed.
- Article layout: 1,187-word minimum and 93 inline images at the exact
  two-paragraph rhythm still pass.
- Responsive images: eleven covers and 32 verified candidates pass.
- Explicit rejection fixtures: outside-article Berlin photography, incidental
  waterfront imagery, missing reviews and future unreviewed stories all fail.
- Preservation: no story was added or removed; private reserve content was not
  touched; production, autonomous publication and article scheduling remain off.

Hosted readback is recorded after the commit reaches the existing Vercel project.

