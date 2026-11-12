/**
 * Caché en disco de los videos de Drive: se descargan una vez y se reproducen
 * desde el disco, incluso mientras siguen bajando.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { DriveVideoCache, parseRangeHeader, totalFromContentRange, type DriveFetcher } from '../server/driveVideoCache.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Drive simulado: entrega el archivo en trozos con pausa, como un enlace real. */
function fakeDrive(size: number, opts: { chunk?: number; delayMs?: number; html?: boolean } = {}) {
  const file = Buffer.from(Array.from({ length: size }, (_, i) => (i * 7) % 251));
  const calls: Array<string | null> = [];
  const fetcher: DriveFetcher = async (_id, range, signal) => {
    calls.push(range);
    if (opts.html) return new Response('<html>cuota</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (range) {
      const r = parseRangeHeader(range)!;
      const start = r.suffix !== undefined ? Math.max(0, size - r.suffix) : r.start;
      const end = r.end === null || r.suffix !== undefined ? size - 1 : Math.min(r.end, size - 1);
      return new Response(file.subarray(start, end + 1), {
        status: 206,
        headers: { 'content-type': 'video/mp4', 'content-range': `bytes ${start}-${end}/${size}` },
      });
    }
    const chunk = opts.chunk ?? 64 * 1024;
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const pos = (this as any).pos ?? 0;
        if (signal.aborted) return controller.error(new Error('aborted'));
        if (pos >= size) return controller.close();
        if (opts.delayMs) await sleep(opts.delayMs);
        controller.enqueue(new Uint8Array(file.subarray(pos, pos + chunk)));
        (this as any).pos = pos + chunk;
      },
    });
    return new Response(stream, { status: 200, headers: { 'content-type': 'video/mp4', 'content-length': String(size) } });
  };
  return { file, calls, fetcher };
}

async function harness(cache: DriveVideoCache) {
  const server = http.createServer(async (req, res) => {
    const ok = await cache.serve('f', req.headers.range, res);
    if (!ok) {
      res.statusCode = 299; // «sigue a Drive» en la ruta real
      res.end('fallback');
    }
  });
  server.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (range?: string) => {
    const res = await fetch(base, { headers: range ? { Range: range } : {} });
    return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
  };
  return { get, close: () => new Promise<void>((r) => server.close(() => r())) };
}

async function tmpDir() {
  return fsp.mkdtemp(path.join(os.tmpdir(), 'docentos-vcache-test-'));
}

test('parseRangeHeader y totalFromContentRange', () => {
  assert.deepEqual(parseRangeHeader('bytes=0-99'), { start: 0, end: 99 });
  assert.deepEqual(parseRangeHeader('bytes=500-'), { start: 500, end: null });
  assert.deepEqual(parseRangeHeader('bytes=-200'), { start: 0, end: null, suffix: 200 });
  assert.equal(parseRangeHeader('bytes=0-1,5-9'), null);
  assert.equal(parseRangeHeader('bytes=9-1'), null);
  assert.equal(totalFromContentRange('bytes 0-1/62286067'), 62286067);
});

test('descarga el video una vez y sirve cualquier tramo desde el disco', async () => {
  const drive = fakeDrive(300_000);
  const cache = new DriveVideoCache({ dir: await tmpDir(), maxBytes: 10_000_000, maxFileBytes: 5_000_000, fetcher: drive.fetcher });
  const h = await harness(cache);
  try {
    const first = await h.get('bytes=0-');
    assert.equal(first.status, 206);
    assert.equal(first.headers.get('content-range'), 'bytes 0-299999/300000');
    assert.deepEqual(first.body, drive.file);
    await sleep(50);
    assert.equal(cache.status('f')?.complete, true);

    const mid = await h.get('bytes=150000-150999');
    assert.deepEqual(mid.body, drive.file.subarray(150_000, 151_000));
    assert.equal(mid.headers.get('x-docentos-cache'), 'disk');
    const tail = await h.get('bytes=-1000');
    assert.deepEqual(tail.body, drive.file.subarray(299_000));
    const full = await h.get();
    assert.equal(full.status, 200);
    assert.equal(full.body.length, 300_000);

    const downloads = drive.calls.filter((c) => c === null).length;
    assert.equal(downloads, 1, 'el archivo entero se pidió a Drive una sola vez');
  } finally {
    await h.close();
  }
});

test('reproduce mientras baja: un tramo aún no descargado espera a la descarga', async () => {
  const drive = fakeDrive(400_000, { chunk: 20_000, delayMs: 15 });
  const cache = new DriveVideoCache({
    dir: await tmpDir(),
    maxBytes: 10_000_000,
    maxFileBytes: 5_000_000,
    waitAheadBytes: 1_000_000,
    fetcher: drive.fetcher,
  });
  const h = await harness(cache);
  try {
    const started = await h.get('bytes=0-999');
    assert.deepEqual(started.body, drive.file.subarray(0, 1000));
    assert.equal(cache.status('f')?.complete, false, 'todavía estaba bajando');
    const ahead = await h.get('bytes=350000-359999');
    assert.equal(ahead.status, 206);
    assert.deepEqual(ahead.body, drive.file.subarray(350_000, 360_000));
  } finally {
    await h.close();
  }
});

test('un salto lejos de lo descargado sigue hacia Drive', async () => {
  const drive = fakeDrive(2_000_000, { chunk: 10_000, delayMs: 30 });
  const cache = new DriveVideoCache({
    dir: await tmpDir(),
    maxBytes: 10_000_000,
    maxFileBytes: 5_000_000,
    waitAheadBytes: 50_000,
    tailBytes: 10_000,
    fetcher: drive.fetcher,
  });
  const h = await harness(cache);
  try {
    await h.get('bytes=0-10');
    const far = await h.get('bytes=1500000-1500999');
    assert.equal(far.status, 299, 'pasa a Drive');
  } finally {
    await h.close();
  }
});

test('el final del archivo (índice del mp4) se sirve antes de terminar la descarga', async () => {
  const drive = fakeDrive(2_000_000, { chunk: 10_000, delayMs: 40 });
  const cache = new DriveVideoCache({
    dir: await tmpDir(),
    maxBytes: 10_000_000,
    maxFileBytes: 5_000_000,
    waitAheadBytes: 10_000,
    tailBytes: 100_000,
    fetcher: drive.fetcher,
  });
  const h = await harness(cache);
  try {
    await h.get('bytes=0-10');
    await sleep(100);
    const tail = await h.get('bytes=-50000');
    assert.equal(tail.status, 206);
    assert.deepEqual(tail.body, drive.file.subarray(1_950_000));
    assert.equal(cache.status('f')?.complete, false);
  } finally {
    await h.close();
  }
});

test('si Drive devuelve una página (cuota o permisos) no se guarda y sigue hacia Drive', async () => {
  const drive = fakeDrive(10_000, { html: true });
  const errors: unknown[] = [];
  const cache = new DriveVideoCache({
    dir: await tmpDir(),
    maxBytes: 10_000_000,
    maxFileBytes: 5_000_000,
    fetcher: drive.fetcher,
    onError: (_id, e) => errors.push(e),
  });
  const h = await harness(cache);
  try {
    assert.equal((await h.get('bytes=0-')).status, 299);
    assert.equal(errors.length, 1);
    assert.equal((await h.get('bytes=0-')).status, 299);
    assert.equal(drive.calls.length, 1, 'no se reintenta enseguida');
  } finally {
    await h.close();
  }
});

test('un video más grande que el límite por archivo no se guarda', async () => {
  const drive = fakeDrive(200_000);
  const cache = new DriveVideoCache({ dir: await tmpDir(), maxBytes: 1_000_000, maxFileBytes: 100_000, fetcher: drive.fetcher });
  const h = await harness(cache);
  try {
    assert.equal((await h.get('bytes=0-')).status, 299);
  } finally {
    await h.close();
  }
});

test('con 0 MB la caché queda desactivada', async () => {
  const drive = fakeDrive(10_000);
  const cache = new DriveVideoCache({ dir: await tmpDir(), maxBytes: 0, maxFileBytes: 0, fetcher: drive.fetcher });
  assert.equal(cache.enabled, false);
  const h = await harness(cache);
  try {
    assert.equal((await h.get('bytes=0-')).status, 299);
    assert.equal(drive.calls.length, 0);
  } finally {
    await h.close();
  }
});

test('la precarga de la lección siguiente espera a que termine la descarga en curso', async () => {
  const drive = fakeDrive(200_000, { chunk: 20_000, delayMs: 20 });
  const cache = new DriveVideoCache({ dir: await tmpDir(), maxBytes: 10_000_000, maxFileBytes: 5_000_000, fetcher: drive.fetcher });
  // Video que se está viendo.
  cache.warm('actual');
  assert.equal(cache.downloading, true);
  // Precarga mientras baja: queda en espera, no abre otra descarga.
  cache.prefetch('siguiente');
  assert.equal(cache.status('siguiente'), null, 'todavía no empezó');
  // Cuando termina la actual, arranca sola la siguiente.
  for (let i = 0; i < 100 && !cache.status('siguiente'); i++) await sleep(20);
  assert.equal(cache.status('actual')?.complete, true);
  assert.ok(cache.status('siguiente'), 'la precarga arrancó al quedar libre');
});

test('sin descargas en curso, la precarga arranca enseguida y no se duplica', async () => {
  const drive = fakeDrive(50_000);
  const cache = new DriveVideoCache({ dir: await tmpDir(), maxBytes: 10_000_000, maxFileBytes: 5_000_000, fetcher: drive.fetcher });
  cache.prefetch('siguiente');
  cache.prefetch('siguiente');
  assert.ok(cache.status('siguiente'));
  await sleep(50);
  assert.equal(drive.calls.filter((c) => c === null).length, 1);
});
