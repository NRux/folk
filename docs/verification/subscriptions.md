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

Vercel has no storage environment configured. Creating the private Blob store
was rejected by the Vercel API with 403: permission to create Blob denied.
No Vercel CLI is available with independent credentials. Noah must connect a
private Blob store to the existing folk project, for production and preview,
using BLOB_STORE_ID/OIDC or BLOB_READ_WRITE_TOKEN. Do not share tokens in chat.

Signup persistence remains blocked until that connection is made and a real
write/readback is verified. This collects a subscriber list; sending newsletters,
confirmation email, distributed abuse limits, and unsubscribe email processing
are not enabled. Publication and recurring article scheduling remain off.
