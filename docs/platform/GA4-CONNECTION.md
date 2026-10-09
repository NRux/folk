# GA4 connection prerequisites

Existing client measurement ID: G-RQJD3XG35C. This is not the reporting property ID.
Do not put Google credentials in the repository or request them through chat.

The collector is server/analytics.js. It has no public HTTP endpoint or cron.
It accepts an injected tokenProvider that must return a short-lived access token
for analytics.readonly, plus a scoped Supabase analytics client. Runtime token
provider integration is pending. Preferred identity is a dedicated service account
with Viewer access to only the Folkly property; prefer supported federation over
long-lived keys. Verify actual provider/platform support before choosing wiring.

Owner-supplied reporting property ID: 558035708 (recorded 2026-10-08).
Saved in the private Supabase analytics configuration and production Vercel
configuration. The match to G-RQJD3XG35C has not yet been verified.

Server configuration; collection remains disabled:

```dotenv
FOLKLY_ANALYTICS_ENABLED=false
GA4_PROPERTY_ID=558035708
GA4_TIME_ZONE=
SUPABASE_ANALYTICS_TOKEN=
```

Existing SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must identify the Folkly project.
SUPABASE_ANALYTICS_TOKEN must be an expiring JWT with role folkly_analytics;
never substitute the service-role key, Google token, publisher JWT or owner session.
The client pre-check is not signature validation; Supabase validates the JWT.

The private folkly_analytics_config property is 558035708 with enabled=false.
Enable collection only after the property/stream match, property timezone and
read access are verified. Neither
that config nor the environment collection switch enables AI generation,
publication or article scheduling. Keep all autonomous switches false.

Run a protected manual connection fixture first. Record property match, timezone,
API permissions, snapshot readback, redaction and disabled publication evidence.
Collection scheduling, retries and AI editorial recommendations are separate
future work in docs/TODOs/GA4-EDITORIAL-IMPLEMENTATION-PROMPTS.md.

## Collector integrity follow-up, 2026-10-09 UTC

The owner reports property/stream verification and bounded GA4 settings completed;
older setup assumptions above are historical. Google Cloud/reporting access is
still deferred; no new credential is required for the offline integrity work.

Report responses are streamed with a one-million-byte cap and strict UTF-8/JSON
validation. Rows require real calendar dates, exactly requested column shapes,
explicit nonnegative numeric strings and exact allowlisted public route variants.
Repeated raw date/path cells and nonascending pages are rejected; canonical and
.html aliases remain distinct cells and are combined once after validation.
Row counts must remain stable and cannot exceed the public-path/window cardinality.

Only known numeric quota fields are retained. If daily/hourly/project tokens or
server-error capacity is explicitly exhausted while rows remain, stop before the
next request and do not save a partial snapshot. A complete valid report can still
be saved when its final response exhausts quota. Omitted quota data is unknown,
not infinite capacity. HTTP 429 exposes only a bounded numeric retry-after hint;
there is no automatic retry. The entire report must validate before the existing
scoped snapshot RPC runs. Idempotent upsert, private ACLs and disabled configuration
are unchanged. Durable sync checkpoints remain a separate unfinished task.
See verification/analytics-report-integrity-2026-10-09.md.
