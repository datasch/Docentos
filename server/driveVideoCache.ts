/**
 * Caché en disco de los videos de Google Drive.
 *
 * Por qué existe: cada petición a Drive tarda de 1,5 a 7 s en dar el primer
 * byte, y el navegador no baja un video de una vez: pide tramos, los cancela al
 * saltar o al llenar su búfer y vuelve a pedir. Con videos pesados (20 Mbps,
 * 2,5 MB por segundo de video) cada una de esas esperas congela la imagen.
 *
 * Qué hace: la primera vez que alguien abre un video, el servidor lo descarga
 * entero de Drive, de corrido y una sola vez, a un archivo temporal. Mientras
 * baja, el navegador ya reproduce lo que va llegando (se sirve "siguiendo" al
 * archivo que crece). Desde ese momento, reproducir, adelantar o volver a abrir
 * la lección sale del disco, sin volver a esperar a Drive. Además se pide aparte
 * el final del archivo, donde muchos mp4 llevan el índice (`moov`), para poder
 * arrancar sin esperar a que baje todo.
 *
 * Si un salto cae lejos de lo ya descargado, la ruta sigue pidiendo ese tramo a
 * Drive como antes: la caché nunca empeora el caso sin caché.
 *
 * El acceso se comprueba antes, en la ruta: aquí solo se guardan bytes por
 * archivo y nunca se decide quién puede verlos.
 */
import { EventEmitter } from 'node:events';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ServerResponse } from 'node:http';

export interface ByteRange {
  start: number;
  end: number | null;
  suffix?: number;
}

/** Cabecera Range de un solo tramo; `null` si falta, es múltiple o inválida. */
export function parseRangeHeader(header: string | undefined | null): ByteRange | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, a, b] = match;
  if (a === '' && b === '') return null;
  if (a === '') return { start: 0, end: null, suffix: Number(b) };
  const start = Number(a);
  const end = b === '' ? null : Number(b);
  if (!Number.isSafeInteger(start) || (end !== null && (!Number.isSafeInteger(end) || end < start))) return null;
  return { start, end };
}

/** Total del archivo a partir de `Content-Range: bytes a-b/TOTAL`. */
export function totalFromContentRange(value: string | null | undefined): number | null {
  const match = /\/(\d+)\s*$/.exec(value || '');
  return match ? Number(match[1]) : null;
}

/** Pide un tramo a Drive. `range` null = archivo entero. */
export type DriveFetcher = (fileId: string, range: string | null, signal: AbortSignal) => Promise<Response>;

export interface DriveVideoCacheOptions {
  dir: string;
  /** Espacio total en disco. 0 desactiva la caché. */
  maxBytes: number;
  /** Archivos más grandes no se guardan (siguen yendo a Drive). */
  maxFileBytes: number;
  /** Bytes del final que se piden aparte para el índice del mp4. */
  tailBytes?: number;
  /** Un salto hasta esta distancia por delante de lo descargado espera a la descarga en vez de ir a Drive. */
  waitAheadBytes?: number;
  /** Cuánto se espera a que llegue un byte antes de rendirse. */
  stallTimeoutMs?: number;
  fetcher: DriveFetcher;
  now?: () => number;
  onError?: (fileId: string, error: unknown) => void;
}

interface Entry {
  fileId: string;
  file: string;
  total: number;
  contentType: string;
  downloaded: number;
  complete: boolean;
  failed: boolean;
  tail: Buffer | null;
  tailStart: number;
  lastUsed: number;
  readers: number;
  events: EventEmitter;
  abort: AbortController;
  ready: Promise<boolean>;
}

export class DriveVideoCache {
  private entries = new Map<string, Entry>();
  private failedAt = new Map<string, number>();
  /** Precargas en espera: solo arrancan cuando no hay otra descarga en curso. */
  private prefetchQueue: string[] = [];
  private readonly tailBytes: number;
  private readonly waitAheadBytes: number;
  private readonly stallTimeoutMs: number;
  private prepared: Promise<void> | null = null;

  constructor(private readonly options: DriveVideoCacheOptions) {
    this.tailBytes = options.tailBytes ?? 2 * 1024 * 1024;
    this.waitAheadBytes = options.waitAheadBytes ?? 12 * 1024 * 1024;
    this.stallTimeoutMs = options.stallTimeoutMs ?? 20_000;
  }

  get enabled(): boolean {
    return this.options.maxBytes > 0;
  }

  /** Estado de un archivo (para diagnóstico y pruebas). */
  status(fileId: string) {
    const e = this.entries.get(fileId);
    return e ? { total: e.total, downloaded: e.downloaded, complete: e.complete, failed: e.failed } : null;
  }

  /** Bytes reservados en disco (los archivos en curso cuentan por su tamaño total). */
  get reservedBytes(): number {
    let sum = 0;
    for (const e of this.entries.values()) sum += e.total;
    return sum;
  }

  /** Vacía la carpeta al arrancar: lo de otra ejecución puede estar a medias. */
  private prepare(): Promise<void> {
    if (!this.prepared) {
      this.prepared = (async () => {
        await fsp.rm(this.options.dir, { recursive: true, force: true }).catch(() => {});
        await fsp.mkdir(this.options.dir, { recursive: true });
      })();
    }
    return this.prepared;
  }

  /** ¿Hay alguna descarga en curso? */
  get downloading(): boolean {
    for (const e of this.entries.values()) if (!e.complete && !e.failed) return true;
    return false;
  }

  /**
   * Precarga de baja prioridad (la lección siguiente). Nunca compite con el
   * video que se está viendo: si hay otra descarga en curso, espera su turno.
   */
  prefetch(fileId: string): void {
    if (!this.enabled || this.entries.has(fileId) || this.prefetchQueue.includes(fileId)) return;
    if (this.downloading) {
      this.prefetchQueue.push(fileId);
      return;
    }
    this.warm(fileId);
  }

  /** Arranca la siguiente precarga pendiente si ya no hay descargas en curso. */
  private drainPrefetch(): void {
    while (!this.downloading && this.prefetchQueue.length > 0) {
      const next = this.prefetchQueue.shift()!;
      if (!this.entries.has(next)) this.warm(next);
    }
  }

  /** Empieza (una sola vez) a descargar el archivo. Devuelve la entrada o null si no se puede guardar. */
  warm(fileId: string): Entry | null {
    if (!this.enabled) return null;
    const existing = this.entries.get(fileId);
    if (existing) return existing.failed ? null : existing;
    const failedAt = this.failedAt.get(fileId);
    if (failedAt && this.now() - failedAt < 60_000) return null;

    const entry: Entry = {
      fileId,
      file: path.join(this.options.dir, `${fileId.replace(/[^A-Za-z0-9_-]/g, '_')}.part`),
      total: 0,
      contentType: 'video/mp4',
      downloaded: 0,
      complete: false,
      failed: false,
      tail: null,
      tailStart: Infinity,
      lastUsed: this.now(),
      readers: 0,
      events: new EventEmitter(),
      abort: new AbortController(),
      ready: Promise.resolve(false),
    };
    entry.events.setMaxListeners(0);
    this.entries.set(fileId, entry);
    entry.ready = this.download(entry);
    return entry;
  }

  private async download(entry: Entry): Promise<boolean> {
    let readyResolved = false;
    let resolveReady!: (ok: boolean) => void;
    const ready = new Promise<boolean>((r) => (resolveReady = r));
    const markReady = (ok: boolean) => {
      if (!readyResolved) {
        readyResolved = true;
        resolveReady(ok);
      }
    };

    (async () => {
      let handle: fsp.FileHandle | null = null;
      try {
        await this.prepare();
        const res = await this.options.fetcher(entry.fileId, null, entry.abort.signal);
        const contentType = res.headers.get('content-type') || '';
        if ((res.status !== 200 && res.status !== 206) || /text\/html/i.test(contentType) || !res.body) {
          throw new Error(`respuesta no válida de Drive (${res.status} ${contentType})`);
        }
        const total =
          (res.status === 206 ? totalFromContentRange(res.headers.get('content-range')) : null) ??
          Number(res.headers.get('content-length') || 0);
        if (!total) throw new Error('Drive no informó el tamaño del archivo');
        if (total > this.options.maxFileBytes) throw new Error(`archivo demasiado grande para la caché (${total} bytes)`);

        entry.total = total;
        entry.contentType = contentType || 'video/mp4';
        this.evict(entry.fileId);
        handle = await fsp.open(entry.file, 'w');
        markReady(true);

        // El índice suele ir al final: se pide aparte para arrancar sin esperar a todo.
        if (total > this.tailBytes * 2) void this.fetchTail(entry);

        const reader = res.body.getReader();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          if (!value || value.length === 0) continue;
          await handle.write(value, 0, value.length, entry.downloaded);
          entry.downloaded += value.length;
          entry.events.emit('progress');
        }
        if (entry.downloaded < entry.total) throw new Error('la descarga terminó antes de tiempo');
        entry.complete = true;
        entry.tail = null;
        entry.events.emit('progress');
      } catch (error) {
        this.fail(entry, error);
      } finally {
        await handle?.close().catch(() => {});
        markReady(false);
        this.drainPrefetch();
      }
    })();

    return ready;
  }

  private async fetchTail(entry: Entry): Promise<void> {
    try {
      const res = await this.options.fetcher(entry.fileId, `bytes=-${this.tailBytes}`, entry.abort.signal);
      if (res.status !== 206 || /text\/html/i.test(res.headers.get('content-type') || '')) return;
      const body = Buffer.from(await res.arrayBuffer());
      if (entry.complete || entry.failed) return;
      entry.tail = body;
      entry.tailStart = entry.total - body.length;
      entry.events.emit('progress');
    } catch {
      // Sin el final, el navegador lo pide y se sirve desde Drive: solo es más lento.
    }
  }

  private fail(entry: Entry, error: unknown): void {
    if (entry.failed) return;
    entry.failed = true;
    entry.abort.abort();
    entry.events.emit('progress');
    if (this.entries.get(entry.fileId) === entry) this.entries.delete(entry.fileId);
    this.failedAt.set(entry.fileId, this.now());
    void fsp.rm(entry.file, { force: true }).catch(() => {});
    if (!(error instanceof Error && error.name === 'AbortError')) this.options.onError?.(entry.fileId, error);
  }

  /** Libera espacio sacando los archivos menos usados que nadie esté leyendo ni descargando. */
  private evict(keep: string): void {
    while (this.reservedBytes > this.options.maxBytes) {
      let victim: Entry | null = null;
      for (const e of this.entries.values()) {
        if (e.fileId === keep || e.readers > 0 || !e.complete) continue;
        if (!victim || e.lastUsed < victim.lastUsed) victim = e;
      }
      if (!victim) break;
      this.entries.delete(victim.fileId);
      void fsp.rm(victim.file, { force: true }).catch(() => {});
    }
  }

  /**
   * Intenta responder la petición desde la caché. Devuelve false si no puede
   * (sin caché, tramo lejano, archivo demasiado grande, Drive fallando) y
   * entonces la ruta la pasa a Drive como siempre.
   */
  async serve(fileId: string, rangeHeader: string | undefined, res: ServerResponse): Promise<boolean> {
    const entry = this.warm(fileId);
    if (!entry) return false;
    const ok = await Promise.race([entry.ready, new Promise<boolean>((r) => setTimeout(() => r(false), 8000))]);
    if (!ok || entry.failed || !entry.total) return false;

    let start = 0;
    let end = entry.total - 1;
    if (rangeHeader) {
      const range = parseRangeHeader(rangeHeader);
      if (!range) return false;
      start = range.suffix !== undefined ? Math.max(0, entry.total - range.suffix) : range.start;
      if (range.end !== null && range.suffix === undefined) end = Math.min(range.end, entry.total - 1);
      if (start >= entry.total) return false;
    }
    entry.lastUsed = this.now();

    // Final del archivo (índice) mientras el resto sigue bajando.
    if (!entry.complete && entry.tail && start >= entry.tailStart) {
      const body = entry.tail.subarray(start - entry.tailStart, end - entry.tailStart + 1);
      this.writeHead(res, entry, start, start + body.length - 1, Boolean(rangeHeader));
      res.end(body);
      return true;
    }

    const reachable = entry.complete || start < entry.downloaded + this.waitAheadBytes;
    if (!reachable) return false;

    this.writeHead(res, entry, start, end, Boolean(rangeHeader));
    await this.pipeFromFile(entry, start, end, res);
    return true;
  }

  private writeHead(res: ServerResponse, entry: Entry, start: number, end: number, partial: boolean) {
    res.statusCode = partial ? 206 : 200;
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', entry.contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Length', String(end - start + 1));
    if (partial) res.setHeader('Content-Range', `bytes ${start}-${end}/${entry.total}`);
    res.setHeader('X-DocentOS-Cache', entry.complete ? 'disk' : 'disk-growing');
  }

  /** Copia [start, end] del archivo a la respuesta, esperando lo que todavía esté bajando. */
  private async pipeFromFile(entry: Entry, start: number, end: number, res: ServerResponse): Promise<void> {
    entry.readers++;
    let handle: fsp.FileHandle | null = null;
    let pos = start;
    const closed = () => res.destroyed || res.writableEnded;
    try {
      handle = await fsp.open(entry.file, 'r');
      while (pos <= end && !closed()) {
        const available = entry.complete ? entry.total : entry.downloaded;
        if (pos >= available) {
          if (entry.failed) throw new Error('la descarga de Drive falló');
          const advanced = await this.waitForProgress(entry, res);
          if (!advanced) throw new Error('la descarga de Drive se detuvo');
          continue;
        }
        const len = Math.min(256 * 1024, end - pos + 1, available - pos);
        const chunk = Buffer.allocUnsafe(len);
        const { bytesRead } = await handle.read(chunk, 0, len, pos);
        if (bytesRead === 0) {
          await this.waitForProgress(entry, res);
          continue;
        }
        pos += bytesRead;
        if (!res.write(bytesRead === len ? chunk : chunk.subarray(0, bytesRead))) {
          await new Promise<void>((resolve) => {
            const done = () => {
              res.off('drain', done);
              res.off('close', done);
              resolve();
            };
            res.on('drain', done);
            res.on('close', done);
          });
        }
      }
      if (!closed()) res.end();
    } catch {
      // Respuesta cortada: el navegador vuelve a pedir el tramo.
      if (!res.destroyed) res.destroy();
    } finally {
      entry.readers--;
      await handle?.close().catch(() => {});
    }
  }

  private waitForProgress(entry: Entry, res: ServerResponse): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => finish(false), this.stallTimeoutMs);
      const onProgress = () => finish(true);
      const onClose = () => finish(false);
      const finish = (value: boolean) => {
        clearTimeout(timer);
        entry.events.off('progress', onProgress);
        res.off('close', onClose);
        resolve(value);
      };
      entry.events.on('progress', onProgress);
      res.on('close', onClose);
    });
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now();
  }
}

/** Ruta por defecto de la caché dentro del contenedor. */
export function defaultVideoCacheDir(tmp: string): string {
  return path.join(tmp, 'docentos-video-cache');
}

