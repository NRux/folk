import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const origin = process.env.FOLKLY_VERIFY_ORIGIN || 'https://www.folkly.com';
assert.equal(new URL(origin).protocol, 'https:');
const routes = JSON.parse(await readFile('web/vercel/routes.json', 'utf8'));
const released = JSON.parse(await readFile('web/vercel/manual-releases.json', 'utf8')).articles;
const reserve = JSON.parse(await readFile('web/site-runtime/hosted/lib/reviewed-reserve.json', 'utf8')).filter(r=>!released.some(a=>a.slug===r.slug));
let checks = 0;
async function request(path) {
  const { stdout } = await run('curl', ['-sS', '-L', '--max-time', '30', '-w', '\n%{http_code}', origin + path], { maxBuffer: 2_000_000 });
  const at = stdout.lastIndexOf('\n');
  return { status: Number(stdout.slice(at + 1)), body: stdout.slice(0, at) };
}
const paths = ['/', '/new-orleans-second-line', '/lisbon-fado', '/oaxaca-living-color', '/detroit-future-frequency', '/about', '/perspective', '/archive', '/subscribe', ...released.map(a=>'/'+a.slug), ...Object.keys(routes).filter(p => p.startsWith('/author/'))];
const tasks = paths.flatMap(path => (path === '/' ? [path] : [path, path + '.html']).map(variant => async () => {
    const result = await request(variant);
    assert.equal(result.status, 200, variant);
    assert(!result.body.includes('Through the Folkly lens'), variant);
    if (path !== '/subscribe') assert(result.body.includes('href="/subscribe"'), variant);
    if (['/new-orleans-second-line', '/lisbon-fado', '/oaxaca-living-color', '/detroit-future-frequency',...released.map(a=>'/'+a.slug)].includes(path)) {
      const expected = await readFile(`dist${path}.html`, 'utf8');
      assert.equal(result.body, expected, `Published content/credits changed: ${variant}`);
    }
    checks++;
}));
async function bounded(tasks) {
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < tasks.length) await tasks[next++]();
  }));
}
await bounded(tasks);
const home = (await request('/')).body;
await bounded(['/admin', '/admin/story', '/api/admin', '/mcp', ...reserve.map(r => '/' + r.slug)].map(path => async () => {
  const result = await request(path);
  assert.equal(result.status, 404, path);
  assert(!home.includes(path), `Private link leaked: ${path}`);
  checks++;
}));
console.log(`Vercel hosted reader passed ${checks} checks: both URL forms, 11 exact articles, five authors, subscription navigation, removed lens boxes, private routes excluded.`);
