# Subscription implementation, 2026-10-07

Removed the requested repeated AI-disclosure sentence from rendered public article
headers. Source footers and substantive editorial notes remain. The build strips
that specific sentence; preserved source captures are retained unchanged.

Added a top-navigation Subscribe link on public pages, responsive subscription
page, email and explicit consent fields, accessible status text, and a Vercel POST
function. Addresses are normalized and saved as private Blob records with hashed
filenames, deduplication, consent version, timestamp, and source. No email address
or storage credential is exposed in HTML or logs. The endpoint validates request
origin, body size, email, consent, and honeypot. It reports success only after a
successful private write (or an existing record); storage failures return 503.

Initial provisioning was rejected by the Vercel API with 403. Noah subsequently
connected Blob to the existing folk project for production and preview; verified
BLOB_STORE_ID and BLOB_READ_WRITE_TOKEN environment metadata without decrypting
credentials. The SDK was already installed at version 2.6.1. No Vercel CLI with
independent credentials is available here, so the Vercel connector was used.

Redeployed source a1524c with the new environment through the existing Vercel
project. Deployment dpl_H6jvEHnrWnGxEjp6ni1ycCr2AURv reached READY and assigned
www.folkly.com and folkly.com. Live POST /api/subscribe with the reserved test
address acceptance-test@example.com returned 200 after the private SDK write.
No email was sent. Exclude this test address from future delivery imports.
Independent authenticated readback remains pending; the storage management API
returned 404 through the connector even though the function's private write worked.

This collects a subscriber list; sending newsletters,
confirmation email, distributed abuse limits, and unsubscribe email processing
are not enabled. Publication and recurring article scheduling remain off.
