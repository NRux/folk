# Owner workspace

The /owner dashboard now has navigation for Overview, Editor chat, Article ideas, Drafts and Inbox. The article-ideas spreadsheet is an editable table: title, place, angle, sources, notes, priority and status. Save each row explicitly. It does not generate or publish an article.

Every workspace request verifies the Supabase user, configured owner email, private owner membership and active session. POST requires the same Origin. JSON is bounded and rendered as text, never executed as markup. Responses are no-store. Logout clears the new private panels and late responses cannot restore them.

Ideas and editor conversations use the existing private Vercel Blob store under owner-workspace/ideas and owner-workspace/chat. They are not committed to Git or embedded in static pages. ETag conditions prevent stale idea edits from overwriting another revision; refresh after a conflict. Listing supports pagination up to 1,000 records, fails explicitly at capacity, and displays the latest 100 chat attempts. Retention/archive work is a future task.

Drafts are read from private Supabase folkly_articles and the latest folkly_article_versions.content_json, after owner authorization. The viewer does not import the private reserve. An article without a migrated version remains unavailable; complete the existing migration/acceptance process before claiming all drafts are accessible.

## Editor chat activation

In the existing Vercel project, configure funded OPENAI_API_KEY, the existing private Blob credentials (BLOB_READ_WRITE_TOKEN or supported linked BLOB_STORE_ID), and FOLKLY_EDITOR_CHAT_ENABLED=true, then redeploy. The default is disabled. Never place these credentials in browser code or commit them. Chat uses the existing OpenAI provider and chat-latest alias. It receives the owner's message and up to six recent completed exchanges; it has no tools to publish or change controls. Conversation text is transmitted to this provider when chat is enabled and submitted.

Requests allow at most 6,000 message bytes, 12,000 total prompt/history bytes and 800 output tokens. The provider timeout is 30 seconds, function duration 60 seconds and SDK retries are disabled. A durable create-only attempt prevents a repeated request ID from charging twice. Twenty daily UTC create-only budget slots reserve $0.15 each ($3/day reservations). Failed/ambiguous attempts retain their slot. These are conservative application limits, not a provider invoice guarantee; review current model rates and configure provider-side spending controls before activation. A pending attempt does not claim a completed reply.

Hosted acceptance still requires authenticated idea save/readback, concurrent edit conflicts, session revocation, actual private draft retrieval, a funded chat response, duplicate paid-attempt denial and interruption recovery. Local mocks do not satisfy those gates. Production/publication/article-schedule controls stay disabled.

Blob follow-up: latest versions may resolve through the private
folkly_content_objects index. The server verifies file path, byte size, SHA-256 and
JSON before returning text through the existing owner endpoint. There is no public
Blob URL or arbitrary file-access route. SQL-backed versions remain compatible;
indexed but missing/corrupt Blob files fail closed. Hosted authenticated viewing
still requires the complete content migration.
