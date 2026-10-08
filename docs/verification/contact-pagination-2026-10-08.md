# Owner inbox pagination, 2026-10-08 UTC

Added First page and Next page controls to the read-only owner contact inbox.
Each page holds at most 20 records. API validates identity, membership and
active session before cursor validation or any Blob access. Missing/invalid
sessions deny access. Cursors are opaque, bounded to 2,048 printable ASCII
characters, passed only as the SDK cursor, never a Blob pathname or URL.
Storage prefix remains contacts/ and each fetched pathname is allowlisted.
Invalid/missing/repeated continuation cursors fail closed without claiming
the inbox is complete. Return URLs and arbitrary private Blob fields are absent.

Logout immediately clears private records and invalidates in-flight status
and inbox reads; late responses cannot repopulate the dashboard. Inbox reads
also ignore responses while the dashboard is hidden. Failed page loads show
unavailable and permit retry from the first page. Storage order remains the
order of navigation, not newest-first or a stable snapshot under concurrent
writes. Page refresh may return updated messages.

Full build and local regression suite passed. Focused contact/paging and owner
authorization tests passed twice: cursor forwarding, final page, malformed and
oversized cursors, repeated continuation rejection, per-request membership and
revocation denial, anonymous denial and no storage reads on invalid cursors.
No live subscriber/contact records were created, read, edited or deleted.
Hosted authenticated paging and browser sign-out race acceptance remain pending.
Public stories/private reserve unchanged; all autonomous switches remain off.
Replies, retention/deletion controls, sorting and durable abuse limits remain
open. Google Cloud setup is deferred; Stage 7 still has migration, MFA, worker
credentials and deployed recovery blockers.

Browser-script VM race fixture passed twice: late status and inbox responses
after sign-out cannot restore private UI. This supports, but does not replace,
a live authenticated browser acceptance check.

Deployed evidence: implementation e94fa1de69f3662c781c7ebee25fa3bf1e80a23a
synced main/master. Production dpl_4jdixt5qXQJ6sN9N1NYeBRtU4RjA and preview
dpl_3smX8yckNXHCoBNrgwDQWeGnmaiH reported READY. Hosted reader regression
passed 38 checks; anonymous paginated inbox GET returned 401. No authenticated
production inbox read was performed.
