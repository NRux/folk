# Public article tags and filters, October 8, 2026

Homepage, archive and active topic/place article grids now expose clickable tags
from the approved published catalog. Progressive enhancement adds multi-tag
selection (any selected tag), place narrowing (combined with tags), newest/oldest
and title sorting, visible result counts, empty results and a clear action.
Filters use shareable `tag`, `place` and `sort` query parameters; unrelated query
parameters and anchors survive updates. Browser-history restoration is handled.

Available options and counts derive from each grid's actual published entries.
Future approved catalog entries automatically receive tags and filter metadata.
The default HTML retains every story and existing topic links; JavaScript-disabled
readers can use those links without encountering nonfunctional filter controls.
Controls are native labeled selects/checkboxes/buttons with visible focus, 44px
tag targets, responsive wrapping and an announced result count. Hidden results
are removed from layout and keyboard navigation through the native hidden attribute.

Validation: build and full regression suite pass. New focused tests cover tag
union, tag/place intersection, no-result behavior, stable sorting, clear/reset,
URL round trips, browser-history restore, catalog immutability, scoped public
options, unknown query values, HTML escaping and actual controller event handling
through a DOM test boundary. Existing article bodies, sources and 93 inline images
remain covered by preservation/layout tests. No private catalog data, authenticated
API requests, storage, credentials or third-party requests are used by filtering.

Full visual/browser mobile acceptance remains pending because Chromium is not
installed in this workspace. These tests do not establish measured accessibility,
Core Web Vitals or deployed custom-domain behavior. No new story was published;
manual release records, private reserve and autonomous switches are unchanged.
