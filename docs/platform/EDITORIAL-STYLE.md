# Editorial wording

Owner preference recorded 2026-10-08: state the thing directly. Avoid
self-referential framing such as “Folkly reads…”, “Folkly sees…”,
“Folkly interprets…” and “through the Folkly lens”.

Describe the practice, relationship or interpretation itself. Keep qualifiers
where evidence supports interpretation rather than a demonstrated fact.
For example: “That openness can serve as cultural infrastructure.”

This rule applies to future drafts, owner-reviewed revisions and analytics
proposals. It does not remove citations, licenses, source ledgers or distinctions
between researched history and editorial interpretation. The model system prompt
includes this instruction. Existing private reserve records remain unchanged
until their normal evidence-bound review/version process.

## Minimum article length and image rhythm

Owner request, October 8, 2026: use **The Weight of Blue: Indigo, Labor, and the
Living Economy of Tokushima** as the minimum length. Its narrative paragraphs
contain **1,187 words**, excluding headings, source lists, superscript citation
numbers, and captions. Published articles must meet that minimum with substantive,
source-supported material and clearly expressed interpretation. Keep longer
stories intact; do not pad them with repeated summaries or invented reporting.

Place one relevant image immediately after **every second narrative paragraph**.
A lead image does not count toward that spacing. Count across subsection headings;
an odd final paragraph needs no extra image. Music-example paragraphs count;
headings, bibliographies, and image captions do not. Use distinct images within a
story, descriptive alt text, concise captions, linked attribution and license,
proportional intrinsic dimensions, and lazy loading below the lead image.
Identify contextual photographs taken elsewhere by their actual location.
Illustrations must be identified as illustrations rather than photographs.

The public offline export enforces both rules in `scripts/article-layout.mjs`.
A future authorized release requires its body template, catalog entry, and
`web/vercel/article-media.json` records together. Missing/duplicate images,
unsafe URLs, unsupported licenses, or short narratives fail the build. Metadata
verification and decoded-download evidence are recorded separately; metadata
alone does not establish image-byte availability or browser performance.
Private drafts/reserve and their historical attestations stay unchanged until
normal owner review and evidence/version reconciliation.


## Give readers a way into unfamiliar words

Owner preference, October 8, 2026: preserve the writing's cadence while making
unfamiliar words intelligible. On first use, introduce the term's meaning and the
context needed to understand its role. This includes non-English words, local
place names, community names, unfamiliar craft/music vocabulary and scientific
names. Do not assume readers recognize a term merely because it is familiar to
its writer. “Aotearoam” in the request refers to **Aotearoa**.

Weave explanation into an apposition, a nearby sentence, or the action of the
paragraph rather than a string of dictionary parentheses. Keep original names,
spelling and diacritics. After introducing a term, use it naturally; repeat a
brief orientation only after a substantial gap or where meanings change.
Do not italicize a word solely because it is not English. Avoid “exotic”,
“primitive”, generic mysticism, or treating a living community as homogeneous.

Context itself can carry the prose. Where the evidence supports it, explain how
a word relates to kinship, landscape, work, memory, seasonal knowledge or local
practice. A translation is an entry point, not a complete account of a concept.
Attribute beliefs and meanings to the named people, community or source that
expresses them. Never manufacture an etymology, ancestral relationship, spiritual
meaning, sensory scene or quotation to make the prose richer. Treat translations,
geographic orientation and cultural explanations as factual claims needing
sources, just like the rest of the article.

Before review, list unfamiliar terms and check their first appearances: can a
reader understand what or whom they refer to and why they matter without leaving
the story? Spread introductions across sentences if a paragraph contains many
new terms. Preserve regional differences and name the specific community where
sources allow. Avoid unnecessary rankings or exact timing claims that add
verification burden without helping understanding. These are editorial review
instructions, not an automatic semantic acceptance test.

See `../TODOs/READER-CONTEXT-WRITING-PROMPTS.md` for drafting, revision and review
prompts, plus a source-checked Matariki/Puanga example. The shared model system
prompt includes this guidance; existing published prose and private reserve
attestations are unchanged by this prompt-only update.
