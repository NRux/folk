# Deployed publisher source

These files mirror the publication modules and focused gate fixture from Folkly
Site version 5, source commit `b61561338efa18c49759b4d5fb35b44fa89ac5ea`.
The canonical Site checkout owns the complete Worker build and deployment.
This directory preserves the verified publisher change in the Folk repository;
it does not replace the Node/SQLite scheduler or enable any publication switch.

Run the mirrored fixture with:

```text
node web/site-runtime/hosted/scripts/test-publication-gates.mjs
```

The publisher uses the Site's Cloudflare D1 binding and immutable review manifest.
Keep its modules synchronized with the canonical Site before deploying future
publisher changes. Review attestations must be regenerated only from reviewed
evidence, never to silence an eligibility failure.
