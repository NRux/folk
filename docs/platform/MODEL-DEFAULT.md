# Latest ChatGPT default

Noah selected the latest ChatGPT model on 2026-10-07. The default is
`openai/chat-latest`, OpenAI's rolling alias for the latest Instant model used in
ChatGPT. Provider snapshots may change without a repository update. Record the
returned model/snapshot with each future job and rerun editorial evaluations
after provider changes before production use.

The current Vercel AI Gateway catalog does not list this alias. The adapter uses
the pinned @ai-sdk/openai chat provider for this default, with server-only
OPENAI_API_KEY. Other explicitly configured provider/model IDs continue through
AI Gateway. Set a funded OpenAI API key securely in Vercel; do not paste it in
chat. No live calls were made and generation remains off.

Reference checked 2026-10-07:
https://developers.openai.com/api/docs/models/chat-latest

Owner setup follow-up: FOLKLY_OWNER_EMAIL is configured as noah@then.tv in Vercel.
Auth user provisioning is still pending. A temporary privileged provisioning
secret was rejected by automatic approval review; no endpoint was deployed and
the local temporary code was removed. Use Supabase Auth's Users dashboard to
create this account; then grant its UUID private membership through the existing
audited setup path. The Magic Link email template must include {{ .Token }} for
the numeric OTP form. No passwords or tokens should be shared in chat.
