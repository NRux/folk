# Folkly owner panel: designer handoff

Prepared for Noah Rappaport and the product designer. Updated October 10, 2026 UTC
(October 9 in Portland). Redesign the existing `/owner` experience in NRux/folk.

## The assignment

Create a calm, capable editorial workspace where Noah can work with the editor,
plan stories, inspect saved drafts and versions, manage translation spending, and
review subscribers and contact messages. Make each action understandable and its
result visible. Keep the cultural character of Folkly while giving the private
workspace the clarity and density of a useful work tool.

The primary user is the owner/editor, working mainly on desktop with occasional
mobile use. The main problem is a long page of loosely connected cards, tables and
forms. Navigation currently jumps between page sections. Operational notices take
up attention, the ideas table is wider than a phone, and progress, availability and
save state are easy to miss. A disabled publishing button should not make the rest
of the panel appear unusable.

This is a redesign of an existing product. Preserve its working flows and security
boundaries. Do not invent data, capabilities or an alternative hosting platform.

## Current product and evidence

| Area | Current behavior | Design implication |
| --- | --- | --- |
| Sign-in | Invite-only email/code sign-in; secure server session, sign-out and expiry notice. | Design sign-in, waiting, invalid/expired code, rate-limit and expired-session states. |
| Overview | Private article metadata, publishing switches, model reservations, jobs, import status, refresh and public archive link. | Group essentials; move diagnostic detail into secondary views. |
| Editor | Private persisted chat with progress, verified reply, unavailable/error states and spending limits. | Distinguish pending, completed and failed attempts; retain unsent text. Chat does not edit or publish an article. |
| Ideas | Editable spreadsheet-like rows with Title, Place, Angle, Sources, Notes, Priority and Status. Explicit per-row Save and verified readback. | Make unsaved/saving/saved/conflict states unmistakable. |
| Drafts and versions | Protected saved-content reader. Version-history selection ships with this handoff; latest is the default. | Separate article status from the selected historical version. No article editor, diff, rollback or publish action exists in this flow. |
| Translations | Public-source and language selection, private Batch jobs, progress/recovery, private draft viewing and an owner-controlled budget. | Make paid submission a deliberate action, distinct from saving settings or reviewing output. |
| Subscribers | Private email/status/consent/source records with bounded paging. | Use a readable private list, clear page controls and truthful delivery status. |
| Inbox | Contact details, reason, contributor interest, message and a mailto reply link. | Highlight the reason and contributor interest. “Reply in email” opens an email app; it does not send or track a reply. |

The original source transfer passed: 11 already-published stories and 15 historical
saved versions, with private content storage and a verified backup. There are zero
unpublished articles in that imported source. The seven earlier manual releases
are already public and must not appear as available reserve content. Historical
versions may differ from later public edits.

The browser available for this handoff shows an expired owner session, so current
authenticated visual behavior is not claimed verified. Use the repository source
and the verification reports as the functional baseline. Use synthetic records in
design files, not real subscribers, private conversation text or credentials.

## Proposed navigation and screen structure

Use a persistent left navigation on desktop and a compact menu on mobile. Keep the
active location visible. Avoid requiring users to scroll through every feature to
reach their work. A small consistent header should contain the page title, public
site link, session/account menu and sign-out. Preserve a clear session-expiry route.

| Navigation | Main content | Primary action |
| --- | --- | --- |
| Overview | What needs attention, recent activity, storage verification, spending summary and publishing readiness. | Open saved stories / Add idea |
| Articles | Metadata list, selected story preview, saved-version selector, publication status and saved date. | View a saved version |
| Editor | Conversation history, composer, request progress and retained-attempt notices. | Send to editor |
| Ideas | Editable planning table; focused row detail on smaller screens. | Add idea / Save row |
| Translations | Sources/languages, spending controls, existing jobs and private draft review. | Submit a batch when permitted |
| Subscribers | Email/status list, consent details, paging and delivery readiness. | View next page |
| Inbox | Message list/detail, contact reason and contributor interest. | Reply in email |

Publishing jobs, reservations and detailed acceptance blockers can live in an
Overview detail area. A separate Settings destination can be a future proposal,
but do not present working settings controls until their backend exists.

Overview should lead with available work. Show a concise “Automatic publishing off”
status and a way to inspect the remaining gates. Keep generation, publication and
article scheduling distinguishable. Avoid a large warning repeated across every
screen. Do not add unverified traffic graphs, “AI insights,” delivery counts or
completion percentages as decoration.

## Essential flows to design

### 1. Plan a story

Open Ideas → Add idea → enter title/place/angle/sources/notes → choose priority and
planning status → Save → see “Saving and verifying…” → see “Saved and verified.”
If a write fails, preserve the row and its text. If another change conflicts, offer
a clear refresh/reconciliation path without silently overwriting. Workspace refresh
must preserve unsaved edits. Status choices are Idea, Research, Drafting and Hold;
changing them does not launch research, generation or publishing.

Desktop should support scanning and editing several rows. Mobile should use a
labelled row detail view or stacked fields rather than a tiny horizontally scrolled
spreadsheet. Do not label this autosave while the system requires explicit Save.

### 2. Work with the editor

Open Editor → type a message → Send → show immediate progress → display the saved
reply. Retain the message if the request fails. A pending/failed attempt remains in
history to prevent duplicate charges; do not offer a retry that secretly repeats
the paid request. Availability errors should explain the next action without
showing raw provider responses. Put diagnostic references behind a small details
control. Keep the composer usable while reviewing previous replies.

Suggestions such as “Develop this angle” or “Explain this term” may be proposed as
composer helpers, but sending remains explicit. Article mutation, draft creation
from chat and attaching a story as model context are future capabilities unless
separately implemented. Do not imply they work through visual affordances alone.

### 3. Inspect an article and its history

Open Articles → select a story → load/verify its latest saved body → choose an
older saved version → inspect the text and saved date. Keep story title, article
status and selected version visible together. Published article status does not
make historical saved content public. Label the preview as private saved content
that may predate the current public story. Switching articles or versions must not
let a late response replace the user's current selection.

Provide legible long-form typography, a comfortable line length and clear section
headings. The current preview renders safe text; rich preview, image rendering,
editing, side-by-side comparison and restore controls belong in a separately scoped
proposal. Display a helpful unavailable/corrupt-content state instead of blank space.

### 4. Budget and request translations

Choose published sources and target languages, inspect the batch size and maximum
reservation, then submit explicitly. Supported targets: 简体中文 (zh-Hans), Español,
हिन्दी, العربية, Français and 日本語. English is the source language. Current bulk
submission is bounded to 12 source/language pairs.

Show the total approved cap, reserved amount, remaining allowance, approval expiry
and per-attempt allowance. Budget entry is in USD, currently capped at $50 with an
approval window of up to 30 days; the server remains authoritative. Saving budget
settings must not start a job. Allowing translation batches is a separate explicit
choice. Failed attempts can retain reservations, so “reserved” is not the same as
provider billing and cannot automatically be refunded or erased in the design.

Batch processing can take up to 24 hours. Design submitted/processing, private
output ready, partial failure, expired/unavailable and reviewed-release-pending
states. Distinguish sync/readback from a new paid submission. A completed translation
job is not an approved public translation. Native-language review and a separate
release remain required. No “Publish all” shortcut.

### 5. Review subscribers and contact messages

Make email, status and consent details easy to scan, with readable paging and an
explicit empty state. Do not infer a total count from one page. Weekly delivery is
not represented as running until its hosted acceptance and activation pass.

In Inbox, make the contact reason and contributor interest prominent. Use a message
reading pane or mobile detail screen. Label the existing action “Reply in email.”
Do not invent sent/replied labels, in-app sending or a contributor approval pipeline.

## Visual direction

Use the existing warm paper background, dark readable text and restrained green
accents as a starting point. Current owner colors include #fffdfa, #d8d6cd and
#58634d. Keep the editorial feel in headings; use highly legible interface type for
forms, navigation, tables and status. Reuse existing assets and accessible fonts;
a redesign should not require paid fonts or heavy animation.

Prioritize alignment, spacing and hierarchy over decoration. Make tables compact
without shrinking labels or hit targets. Use one strong primary action per screen.
Use semantic states with text and icons, not color alone. Reserve warning/error
emphasis for a problem requiring attention. Avoid a generic dashboard wall of
cards, ornamental metrics, giant gradients, glass effects and repeated banners.

Write plain, specific copy. “Saved and verified,” “Reply pending,” “Sign in again”
and “Remaining budget” are useful. Avoid “Folkly reads…” framing, vague AI promises,
excessive disclaimers and raw implementation details in normal workflows.

## Required component and interaction states

Deliver reusable navigation/header, buttons, labelled inputs, textarea, select,
budget input, status badges, message history/composer, table/list, pagination,
article preview/version picker, empty state, skeleton/progress, inline error and
session-expiry notice.

Show default, keyboard focus, hover, disabled-with-reason, loading, success,
validation error, partial outage, stale/conflict and session-expired states where
relevant. Define dirty-form navigation behavior without persisting private drafts
in browser storage by default. On sign-out or expiry, clear private content and
prevent pending responses from restoring it. Never show a successful save before
server readback confirms it.

Target accessible contrast, visible focus, semantic headings/labels, keyboard
navigation and readable errors. Live status announcements should report meaningful
changes without repeatedly reading the entire conversation. Dialogs/drawers need
focus management and a clear return path. Respect reduced-motion preferences.
Test widths 375, 390, 768, 1024 and 1440, long titles, long translated labels,
multiline idea fields and large contact messages. The private owner UI can remain
English in this scope; multilingual reader work is a separate system.

## Safety and scope boundaries

- Preserve server-verified owner membership/session checks, same-origin mutations,
  private/no-store responses, private Blob storage and safe text rendering.
- Keep autonomous generation, publication and article scheduling off. Enabling
  them needs completed deployed gates and applicable owner/MFA authorization.
- No credentials, tokens or provider secret values in a settings form, mockup,
  analytics event, screenshot or handoff. Do not track private owner content.
- Preserve existing public stories, image licenses/credits, subscriptions, ideas,
  conversations and saved historical versions. Viewing must not alter them.
- Treat source import and authenticated UI acceptance as separate results.
  Existing verified import receipts support status; they do not certify all later
  edits or the full publisher/newsletter recovery flow.

## Deliverables and acceptance

Deliver a clickable desktop prototype, corresponding mobile flows, component/state
specifications, typography/color/spacing tokens and an annotated engineer handoff.
Include every essential flow above, not just the Overview screen. Use clearly
marked synthetic data. Separate a first implementation matching today's backend
from future feature proposals with new API/data requirements.

The first design review should demonstrate that Noah can find and open a saved
story, switch versions, start an idea, understand whether it saved, send a chat
message, understand a translation reservation, and locate a subscriber or contact
message. Demonstrate failures, expiry and unsaved edits as well as happy paths.
Avoid navigation dead ends, misleading enabled controls and ambiguous paid actions.

Engineering acceptance requires actual authenticated browser/API/data readback,
mobile/keyboard checks, protected-route denial and preserved published content.
A prototype or fixture test does not establish hosted acceptance. Publish/schedule
activation is outside this redesign's acceptance.

## Engineering reference map

Read the latest files on main before implementation; concurrent work may advance.

- Entry shell: [web/vercel/owner.html](../../web/vercel/owner.html).
- Session, overview, inbox and subscriber client: [web/vercel/owner.js](../../web/vercel/owner.js).
- Editor, ideas and saved-version client: [web/vercel/owner-workspace.js](../../web/vercel/owner-workspace.js).
- Translation/budget client: [web/vercel/owner-translations.js](../../web/vercel/owner-translations.js).
- Workspace contract: [server/owner-workspace.js](../../server/owner-workspace.js).
- Dashboard metadata/import status: [server/owner-dashboard.js](../../server/owner-dashboard.js).
- Private API routes: `/api/owner`, `/api/owner-workspace`, `/api/owner-translations`.
- Current build: [docs/TODOs/BUILD-STATE.md](../TODOs/BUILD-STATE.md).
- Acceptance: [docs/verification/acceptance-report.md](../verification/acceptance-report.md).
- Verified original transfer: [hosted-editorial-import-2026-10-09.md](../verification/hosted-editorial-import-2026-10-09.md).
- Accessibility reference: https://www.w3.org/WAI/WCAG22/quickref/ .

Production reference: https://www.folkly.com/owner . No live signed-in screenshots
are included because the available session expired; authentication is required to
review actual private content. No additional source export or new provider secret
setup is required for the completed content transfer.
