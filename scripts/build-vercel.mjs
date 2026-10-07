import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname } from 'node:path';

// Public-only, offline build. Never copy the repository, DB, or reserve into dist.
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const origin = process.env.FOLKLY_PUBLIC_ORIGIN || 'https://www.folkly.com';
const canonical = new URL(origin);
if (canonical.protocol !== 'https:' || canonical.pathname !== '/' || canonical.search || canonical.hash || canonical.username || canonical.password) {
  throw new Error('FOLKLY_PUBLIC_ORIGIN must be an HTTPS origin');
}
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const [route, file] of Object.entries(routes)) {
  if (!/^\/(?:[a-z0-9-]+\/)*[a-z0-9-]*$/.test(route) || /^(?:\/admin|\/api|\/mcp)/.test(route) || !/^[a-z0-9_-]+\.html$/.test(file)) {
    throw new Error(`Unsafe public route: ${route}`);
  }
  let html = await readFile(`web/vercel/pages/${file}`, 'utf8');
  html = html.replace(/https:\/\/folkly-journal\.[a-z0-9.-]+\.site/g, canonical.origin);
  const target = route === '/' ? 'dist/index.html' : `dist${route}.html`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
}
await cp('web/static/assets', 'dist/assets', { recursive: true });
await cp('web/static/style.css', 'dist/style.css');
await writeFile('dist/404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Page not found | Folkly</title><h1>Page not found</h1><a href="/">Return to Folkly</a></html>');
console.log(`Built ${Object.keys(routes).length} public pages and journal assets for Vercel; publisher disabled.`);
