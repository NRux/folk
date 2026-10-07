# Deployed Site evidence attestation — 2026-10-07

Folkly Site version 5, source commit `b61561338efa18c49759b4d5fb35b44fa89ac5ea`,
binds each of the seven reviewed reserve stories to a SHA-256 digest of its
source ledger, claim links, deterministic checks, and applicable image-rights
record. The Worker recomputes that digest before selecting a story and repeats
the mutable evidence checks inside the atomic D1 batch that claims the daily
publication slot.

The focused publication-gate fixture passed twice. It covers the valid path and
holds for a dangling source ID, a missing required check, a missing disclosure,
and a changed reviewed claim. The full production build passed; lint reported
no errors and ten pre-existing warnings. All seven live evidence digests matched
their new attestations before deployment.

Post-deployment checks confirmed Site version 5, four public stories, seven
private reserve stories, zero publication slots, anonymous denial for the admin
and MCP write surface, and no failed Worker outcomes. Production, publication,
and schedule settings remain false.

The authenticated owner session, an unattended publisher connection, a
production model provider, authenticated publish/readback and failure recovery,
and a true mobile viewport test remain open acceptance gates.
