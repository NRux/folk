# Owner dashboard

Implemented 2026-10-08 UTC. Noah reported successful email-code sign-in after
configuring SMTP. This is user-reported live sign-in evidence, not independent
verification of the entire owner authentication acceptance suite.

Replaced raw settings JSON with a responsive editorial dashboard. The existing
owner API validates identity, private membership and active session before
loading bounded article metadata, job status, model caps and reservation history.
Queries exclude article bodies, raw job errors, sources, usage evidence and
credentials. The interface renders text through textContent, not HTML injection.
Each section distinguishes a database outage from an empty result.

The sign-in form hides on successful authenticated readback. Sign-out clears
visible private data even if revocation reports an error. A 60-second status
check clears the dashboard on session expiry or unavailable authentication.
Tables scroll on narrow screens; status updates use an accessible live region.

Publication and configuration controls remain disabled. The dashboard explains
that four public stories are served separately and seven private reserve stories
remain in the original Site pending verified migration. Empty editorial tables
are not presented as a vanished public archive. Analytics is explicitly planned,
not represented as connected. No subscriber data is exposed.

Validation: full build/npm test passed, including unauthorized/revoked membership
and session denial before dashboard loading, bounded safe columns, partial query
outage handling and no credential/error disclosure. Public reader routes and
private reserve exclusion pass existing checks. Live anonymous API denial and
Vercel deployment status are checked after syncing.

Remaining: migrated content/draft detail and review actions, job recovery actions,
analytics feed, MFA-protected configuration/publishing, full hosted authentication
and recovery acceptance. This release is a read-only dashboard foundation.
All autonomous generation/publication/schedule switches remain off.
