# Vercel hosting

Folkly must be hosted on Vercel. The repository root now builds the public journal
with `npm run build` into `dist`; `vercel.json` declares that output explicitly.
Use the existing Vercel `folk` project, repository root, framework Other, Node 24.
No install dependencies or runtime credentials are required for the public reader.
Run `npm run build && npm test` before deployment.

The committed public HTML is a capture of the existing deployed journal, including
its four published stories, source links, rights credits, disclosures, and archives.
Only public routes are built. Images and CSS are served by Vercel.
The build is offline and does not proxy traffic to Sites. Set
`FOLKLY_PUBLIC_ORIGIN` to an HTTPS origin to override `https://www.folkly.com`.

This fixes empty Vercel deployments. It is the public hosting migration, not the
completed editorial backend migration. The reserve and existing database remain
preserved in their current stores; no private database is copied to public output.
Admin, MCP, research, publication, and scheduling are unavailable on this static
reader and must remain off. No SPA fallback or cron is configured.

Next gate: provision durable Vercel-compatible SQL storage, migrate and verify the
private reserve, replace Sites owner authentication with verified owner sessions,
port publisher transactions and unattended credentials, and pass deployed failure,
security, and mobile acceptance checks before enabling autonomous publication.
Do not run the Node SQLite scheduler on Vercel's ephemeral filesystem.
