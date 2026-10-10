# Isolated hosted newsletter storage recovery

Date: 2026-10-10 UTC. Existing NRux/folk repository, Vercel project
prj_d93TLitMYu8uYjqfgvgANuwsRJVK and Supabase vxmyggasjgsiohqzzwzh.

## Scope and implementation

An administrative check exercises the actual newsletter store using the existing
private Blob credentials inside Vercel. Every logical subscriber/claim/receipt/
suppression path is mapped under `acceptance/newsletter/<grant-UUID>/<scenario>/`.
Only a server-chosen synthetic .invalid address is used. No real subscriber is
read or changed, and no caller can supply an address, path, fixture, provider,
recipient or arbitrary operation. There is no Resend/mail adapter or send action.

The new grant table is private/RLS enabled, client permissions revoked and limited
to server read/update. Only an administrator can issue a ten-minute hashed bearer
grant. The grant binds the exact deployed checker/store/record source bytes;
paused article settings, one atomic claim, expiry and fencing UUID are enforced
in service-role-only invoker RPCs. The HTTP route also requires newsletter delivery
paused. It is not owner-login authentication and cannot access the owner workspace.
It cannot issue tickets, enable delivery/publishing or remove grants/evidence.

The request allows only the fixed format operation and at most 128 body bytes.
Methods, origin, query, range and media type are restricted. Storage calls have
deadlines; exact private paths, create-only writes, stream bounds and strict UTF-8
use the production adapter. Responses are no-store/no-referrer/noindex; failures
log only fixed stages/codes and correlation UUIDs. Failed/ambiguous grants remain
held. There is no automatic retry, deletion or evidence overwrite.

The runner reads the one-use token from hidden stdin rather than argv/chat/Git,
pins the source contract, refuses existing/public/repository receipt paths,
requires the complete redacted proof and writes a new mode-0600 private receipt.

## Checks

| Check | Required evidence |
| --- | --- |
| Five concurrent claims | Exactly one claim succeeds; four are held. |
| Immutable original claim | Separate accepted receipt does not alter the original claim content. |
| Terminal receipt | Exact uncached readback, including idempotent finish. |
| Lost receipt-write reply | Actual persisted write followed by injected reply loss is reconciled by exact readback. |
| Interrupted claim reply | Actual persisted claim followed by injected reply loss stays held across a fresh store instance. |
| Receipt-only restore | Verified original receipt is copied into a new isolated namespace; missing claim cannot cause resend. |
| Complete restore | Original claim is then copied/read back; delivery remains held. |
| Concurrent/repeated suppression | First verified timestamp remains stable. |
| Corrupt suppression | Invalid isolated record is preserved and rejected, never interpreted as subscription status. |
| Subscriber readback | Exact synthetic record enumeration and identity/consent validation. |
| Independent inventory | Separate SDK prefix enumeration and uncached reads establish every expected object, no extras, and an aggregate digest. |

The restore and reply-loss scenarios deliberately inject the loss; they exercise
real storage operations but do not assert that a real provider outage occurred.
All fixture evidence is retained privately; the fixed operation creates ten small
objects and rejects inventories larger than thirty. Nothing is deleted to test
restore. Provider IDs are explicitly synthetic and never represent email acceptance.

## Verification at implementation checkpoint

Build PASS: 73 public pages/11 existing published stories; all 39 regression
commands PASS with 55 concurrent unapproved translation drafts retained. The new
suite tests the actual store/checker, malicious prefix/listing, missing restore
readback, administrative issuance/client denial, expiry/lease/replay/paused-state
fences, receipt schema/redaction, input bounds, deployment inclusion and safe CLI.
Focused security/debug rerun passes after CLI preservation tests were added.

Migration applied in existing Supabase. A hosted rollback-only administrative
fixture successfully claimed and completed with service_role; replay and wrong
lease were rejected, private RLS was enabled and no fixture grants remained.
Anon/authenticated cannot read; anon cannot claim; service_role cannot issue/delete.
All three article switches remain false. No production setting was altered.

Security advisor: the private tables' INFO RLS-without-policy notices are intentional
server-only denial, not a reason to add client policies. The advisor also reports
the existing Auth leaked-password-protection WARN; review the account protection
setting separately. No Auth settings were changed for this storage work.
References: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Actual hosted storage result PASS

Code `6dd0757de587b8809d31afc0cdb43f3ff8d6a9c3` deployed successfully:
https://vercel.com/optagens-projects/folk/2hzLLAsGqmwcF9oXtaK7K7q8CZne.
The actual hosted checker completed at **2026-10-10 02:11:55 UTC**. All eleven
checks passed against the existing private Blob store, with exactly ten isolated
objects. The local hidden-stdin runner validated and saved the complete proof.
There were **zero emails and zero paid/provider calls**.

An independent native Supabase connection verified the exact same aggregate
receipt, verified grant status and cleared lease. All three article switches
remained false; the original inventory stayed at 11 articles/15 versions/15 private
content references. Actual retired-token POST replay returned **401/no-store**,
as did anonymous GET. The one-use local bearer token was then removed. Fixture
objects and the private retired grant remain preserved for reviewed inspection.

All **45 deployed reader checks** pass, including exact existing article content
and credits, private-route exclusion and both public URL forms. Concurrent
translation drafts were preserved on both branches; a refreshed 59-draft baseline
passed build and focused translation/shared-UI/recovery tests. None was approved
or released. The Vercel connector was not used.

Redacted aggregate evidence: [hosted receipt](newsletter-hosted-storage-live-2026-10-10.json).
This closes the **isolated hosted newsletter storage recovery component**, not
Resend acceptance, inbox delivery, the public signed-unsubscribe route, actual
owner sessions or the full publisher/Stage 7 gate.

## Reproduction and remaining gates

Keep newsletter delivery and all three article switches disabled. Run
`node scripts/test-hosted-newsletter-recovery.mjs` and obtain `recoveryContract()`
from the reviewed exact checker/store source. Privately generate a 32-byte random
one-use bearer token. An administrator inserts only its SHA-256 and contract hash
into `folkly_newsletter_recovery_grants`, expiring within ten minutes. The runtime
cannot do this. Never put the token or configured service secrets in chat/Git.

Run `node scripts/run-newsletter-recovery.mjs <new-private-receipt.json>` and supply
the token on hidden stdin. It POSTs only the fixed operation to the existing site's
API. Independently read the grant's status/receipt, require verified and lease null,
compare the aggregate proof, then confirm actual replay returns 401/no-store.
If a run is interrupted, inspect/preserve its private grant/fixture evidence; do
not reset the ticket or delete claims. A reviewed new ticket has its own namespace.

This check can close only the isolated hosted storage component. Full consented
recipient/provider/mailbox acceptance, signed unsubscribe HTTP processing, actual
owner subscriber/draft viewing, publisher/model/served-content recovery and full
Stage 7 activation remain separate OPEN gates. No mail or paid model call, public
story/translation release, cron change or autonomous activation is authorized by
a successful storage check. No additional provider signing-secret setup is needed.
