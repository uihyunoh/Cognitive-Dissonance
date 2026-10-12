import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const workerCode = await readFile(new URL('dist/media-worker.js', root), 'utf8');
const preloadCode = await readFile(new URL('dist/media-preload.js', root), 'utf8');
const payload = Uint8Array.from({ length: 1024 }, (_, index) => index % 251);
const response = () => new Response(payload, { headers: { 'Content-Type': 'video/mp4', ETag: '"film"' } });

function runtime({ scope = 'https://example.test/cognitive-dissonance/', network, brokenStorage = false } = {}) {
  const listeners = new Map();
  const storage = new Map();
  const calls = [];
  let claimed = false;
  const caches = {
    async keys() { return [...storage.keys()]; },
    async delete(name) { return storage.delete(name); },
    async open(name) {
      if (brokenStorage) throw new Error('Storage unavailable');
      if (!storage.has(name)) storage.set(name, new Map());
      const entries = storage.get(name);
      return {
        async match(key) { return entries.get(String(key))?.clone(); },
        async put(key, value) {
          const bytes = await value.arrayBuffer();
          entries.set(String(key), new Response(bytes, { status: value.status, headers: value.headers }));
        },
      };
    },
  };
  const self = {
    registration: { scope },
    clients: { async claim() { claimed = true; } },
    skipWaiting() {},
    addEventListener(name, listener) { listeners.set(name, listener); },
  };
  vm.runInNewContext(workerCode, {
    self, caches, URL, Headers, Request, Response,
    fetch: async (...args) => {
      calls.push(args);
      return network ? network(...args) : response();
    },
  });
  const video = new URL('assets/media/film-01.mp4', scope).href;
  function message() {
    let lifetime;
    listeners.get('message')({ data: { type: 'PREFETCH_FIRST_VIDEO' }, waitUntil(promise) { lifetime = promise; } });
    assert.equal(typeof lifetime?.then, 'function', 'prefetch lifetime belongs to the worker');
    return lifetime;
  }
  function request(range, url = video, extraHeaders = {}) {
    let pending;
    const headers = { ...extraHeaders, ...(range ? { Range: range } : {}) };
    listeners.get('fetch')({ request: new Request(url, { headers }), respondWith(promise) { pending = promise; } });
    return pending;
  }
  async function activate() {
    let pending;
    listeners.get('activate')({ waitUntil(promise) { pending = promise; } });
    await pending;
  }
  return { calls, storage, video, message, request, activate, claimed: () => claimed };
}

test('home registers a project-scoped worker and requests only the first film', async () => {
  const registrations = [];
  const messages = [];
  const registration = { active: { postMessage: message => messages.push(message) } };
  vm.runInNewContext(preloadCode, {
    URL, document: { baseURI: 'https://example.test/cognitive-dissonance/' },
    navigator: { serviceWorker: {
      async register(...args) { registrations.push(args); return registration; },
      ready: Promise.resolve(registration),
    } },
    fetch() { assert.fail('A working worker must own the prefetch'); },
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(registrations.length, 1);
  assert.equal(registrations[0][0], './media-worker.js');
  assert.equal(registrations[0][1].scope, './');
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, 'PREFETCH_FIRST_VIDEO');
});

test('unsupported or denied workers fall back without breaking navigation', async () => {
  for (const navigator of [{}, { serviceWorker: { register: () => Promise.reject(new Error('denied')) } }]) {
    const calls = [];
    vm.runInNewContext(preloadCode, {
      URL, navigator, document: { baseURI: 'https://example.test/cognitive-dissonance/index.html' },
      fetch: async (...args) => { calls.push(args); return response(); },
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'https://example.test/cognitive-dissonance/assets/media/film-01.mp4');
    assert.equal(calls[0][1].cache, 'force-cache');
  }
});

test('concurrent visits and repeat visits download the film once', async () => {
  const app = runtime();
  await Promise.all([app.message(), app.message()]);
  await app.message();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0][0], app.video);
  assert.equal(app.calls[0][1].cache, 'reload');
});

test('cached playback reuses the exact bytes without another network request', async () => {
  const app = runtime();
  await app.message();
  const played = await app.request();
  assert.equal(played.status, 200);
  assert.deepEqual(new Uint8Array(await played.arrayBuffer()), payload);
  assert.equal(app.calls.length, 1);
});

test('Safari probes, seeking, open ranges and suffix ranges are served from cache', async () => {
  const app = runtime();
  await app.message();
  for (const [range, start, end] of [
    ['bytes=0-1', 0, 1], ['bytes=128-255', 128, 255],
    ['bytes=900-', 900, 1023], ['bytes=-25', 999, 1023], ['bytes=0-99999', 0, 1023],
  ]) {
    const played = await app.request(range);
    assert.equal(played.status, 206);
    assert.equal(played.headers.get('Content-Range'), `bytes ${start}-${end}/1024`);
    assert.equal(played.headers.get('Content-Length'), String(end - start + 1));
    assert.equal(played.headers.get('Accept-Ranges'), 'bytes');
    assert.deepEqual(new Uint8Array(await played.arrayBuffer()), payload.slice(start, end + 1));
  }
  assert.equal(app.calls.length, 1);
});

test('unsatisfiable ranges return 416 while complex requests retain network handling', async () => {
  const app = runtime();
  await app.message();
  for (const range of ['bytes=1024-', 'bytes=25-10', 'bytes=-0']) {
    const played = await app.request(range);
    assert.equal(played.status, 416);
    assert.equal(played.headers.get('Content-Range'), 'bytes */1024');
  }
  await app.request('bytes=0-1,10-11');
  await app.request('bytes=0-1', app.video, { 'If-Range': '"old-film"' });
  assert.equal(app.calls.length, 3);
});

test('an early click does not wait for the entire prefetch to finish', async () => {
  let completeWarm;
  let requests = 0;
  const app = runtime({ network: () => {
    requests += 1;
    return requests === 1 ? new Promise(resolve => { completeWarm = resolve; }) : response();
  } });
  const warming = app.message();
  await new Promise(resolve => setImmediate(resolve));
  const played = await app.request('bytes=0-1');
  assert.equal(played.status, 200, 'the unblocked network fallback responds');
  assert.equal(requests, 2);
  completeWarm(response());
  await warming;
  const cached = await app.request('bytes=0-1');
  assert.equal(cached.status, 206);
  assert.equal(requests, 2);
});

test('storage and prefetch failures keep native network playback available', async () => {
  const app = runtime({ brokenStorage: true });
  await app.message();
  const played = await app.request('bytes=0-1');
  assert.equal(played.status, 200);
  assert.equal(app.calls.length, 1);
  const failed = runtime({ network: () => new Response('unavailable', { status: 503 }) });
  await failed.message();
  assert.equal((await failed.request()).status, 503);
  assert.equal(failed.calls.length, 2, 'a failed response was not cached');
});

test('cache activation removes only old portfolio film caches', async () => {
  const app = runtime();
  await app.message();
  app.storage.set('cognitive-dissonance-first-film-old', new Map());
  app.storage.set('another-app', new Map());
  await app.activate();
  assert.equal(app.storage.size, 2);
  assert.equal(app.storage.has('another-app'), true);
  assert.equal(app.storage.has('cognitive-dissonance-first-film-old'), false);
  assert.equal(app.claimed(), true);
});

test('root and GitHub project scopes intercept no other files or films', async () => {
  for (const scope of ['https://example.test/', 'https://example.test/cognitive-dissonance/']) {
    const app = runtime({ scope });
    await app.message();
    assert.equal(app.calls[0][0], new URL('assets/media/film-01.mp4', scope).href);
    assert.equal(app.request(null, new URL('assets/media/film-02.mp4', scope).href), undefined);
    assert.equal(app.request(null, new URL('photo.html', scope).href), undefined);
  }
});

test('published HTML starts prefetch on home and resolves every local link below a project path', async () => {
  const base = 'https://example.test/cognitive-dissonance/';
  const main = await readFile(new URL('dist/index.html', root), 'utf8');
  assert.equal((main.match(/id="first-film-preload"/g) || []).length, 1);
  assert.ok(main.includes(preloadCode));
  const player = await readFile(new URL('dist/2d-view.html', root), 'utf8');
  assert.match(player, /id="artwork-video" controls playsinline preload="auto"/);
  for (const page of ['index.html', '2d-view.html', 'photo.html', 'uihyun-oh.html']) {
    const markup = await readFile(new URL(`dist/${page}`, root), 'utf8');
    for (const [, path] of markup.matchAll(/(?:src|href|poster)="(\.\/[^\"]+)"/g)) {
      const resolved = new URL(path, base);
      assert.ok(resolved.pathname.startsWith('/cognitive-dissonance/'));
      await access(new URL(`dist/${path.slice(2)}`, root));
    }
  }
  const film = await readFile(new URL('dist/assets/media/film-01.mp4', root));
  assert.ok(workerCode.includes(createHash('sha256').update(film).digest('hex').slice(0, 16)));
});
