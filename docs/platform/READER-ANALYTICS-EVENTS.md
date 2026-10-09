# Reader analytics events

Implemented 2026-10-09 UTC for the existing consent-controlled GA4 stream
G-RQJD3XG35C. This does not enable the server collector, Google reporting access,
model proposals, autonomous editing or publication. Google Cloud remains deferred.

| Event | Trigger | Allowed fields |
| --- | --- | --- |
| article_read_depth | First scroll observation reaching 25, 50, 75 or 90 percent of article-body height | article_id, content_version, read_depth |
| related_story_click | Link to a published story in the related card panel | article_id, content_version, target_article_id |
| music_example_click | Link inside the article's music-examples section | article_id, content_version |
| subscribe_success | Subscription API success after durable private-record acknowledgement | none |

The privacy bridge accepts only the exact event/field allowlists and bounded
slug/version/milestone values. Optional events never carry email, OTP, form text,
link destinations or raw query/hash values. Events and the GA loader operate only
on the two production Folkly origins after analytics consent. Withdrawal blocks
the bridge immediately before the existing reload. Owner pages have no analytics
bridge or event script. Preview, localhost, private and non-story routes have no
article identity. Pre-consent milestones are dropped, never queued or replayed.
Milestones are once per page instance/source version, not once per lifetime user.
Depth is a layout-based proxy; it cannot prove attention or comprehension. Hidden
tabs do not emit scroll milestones. Click telemetry does not delay navigation.

`/story.html` and `/story` share a slug/version. Page locations and initial
referrers omit query/hash values. Content versions hash the generated article,
including narrative and media; unrelated footer/analytics asset edits do not
change the story version. The public `article-release-registry.json` contains
only current published slugs, content hashes and declared publication/modification
dates. These declared dates are not verified deployment activation times. Git
release/deployment evidence must supply actual served intervals before historical
GA rows can be attributed confidently to a version. Do not sum daily unique users
or treat event/view ratios as individual conversion probabilities.

The subscription endpoint deliberately acknowledges successful repeated opt-ins
to the same normalized address. Consequently subscribe_success counts completed,
consented requests, not unique new subscribers. Count unique recipients privately
from subscriber storage; never send those addresses to GA4. Failed API responses,
honeypots and unavailable storage do not emit subscription success.

## GA4 account work still required

In property 558035708, verify the stream matches the production domain and
measurement ID. Register event-scoped custom dimensions for article_id,
target_article_id and read_depth if needed in reporting. Do not register the
high-cardinality content_version as a routine aggregate dimension; retain the
version registry/release evidence instead. Inspect enhanced-measurement settings:
disable automatic form interactions and other unbounded URL/search collection
when using these explicit events. Do not assume those account settings were
changed by deploying code. Obtain authorized DebugView/Realtime evidence with
explicit consent and test-traffic filtering; no live GA access was available for
this verification. Google's automatically collected events are separate from
the four events above and need account-side acceptance.

The deferred read-only reporting connection still requires secure server-only
Viewer credentials for the verified property. A measurement/property ID alone
cannot read reports. Never paste secrets in chat or commit them.

Official references checked 2026-10-09 UTC:

- https://developers.google.com/analytics/devguides/collection/ga4/reference/events
- https://developers.google.com/tag-platform/gtagjs/reference/parameters
- https://developers.google.com/tag-platform/security/guides/consent

Focused tests use VM/browser-event fixtures without Google requests. They prove
payload timing, consent and exclusion logic, not actual property delivery or
automated collection account settings.
