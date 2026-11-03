import { get, list, put, BlobPreconditionFailedError } from "@vercel/blob";
import { promises as fs } from "fs";
import path from "path";
const LOCAL = !process.env.BLOB_READ_WRITE_TOKEN; // tests and first boot without a store
const localPath = (p: string) => path.join(process.cwd(), ".localstore", p);
export async function readBytes(p: string): Promise<{ bytes: Buffer; etag?: string; type?: string } | null> {
  if (LOCAL) { try { return { bytes: await fs.readFile(localPath(p)) }; } catch { return null; } }
  const r = await get(p, { access: "private", useCache: false });
  if (!r || !r.stream) return null;
  const bytes = Buffer.from(await new Response(r.stream).arrayBuffer());
  // Compressed reads report a weak tag (W/"..."); conditional writes need the strong form.
  return { bytes, etag: r.blob.etag?.replace(/^W\//, ""), type: r.blob.contentType ?? undefined };
}
type WriteOpts = { ifMatch?: string; createOnly?: boolean };
export async function writeBytes(p: string, data: Buffer | string, type: string, opts: WriteOpts = {}) {
  if (LOCAL) {
    await fs.mkdir(path.dirname(localPath(p)), { recursive: true });
    if (opts.createOnly) { try { await fs.writeFile(localPath(p), data, { flag: "wx" }); return; } catch { throw new Error("conflicting operation"); } }
    await fs.writeFile(localPath(p), data); return;
  }
  await put(p, data, { access: "private", contentType: type, addRandomSuffix: false, allowOverwrite: !opts.createOnly, cacheControlMaxAge: 60, ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : {}) });
}
export async function readJSON<T>(p: string): Promise<{ value: T; etag?: string } | null> {
  const r = await readBytes(p);
  return r ? { value: JSON.parse(r.bytes.toString("utf8")) as T, etag: r.etag } : null;
}
const isConflict = (e: unknown) => e instanceof BlobPreconditionFailedError || /conditional request|conflicting operation|already exists/i.test(String((e as Error)?.message));
// Read, change, write. If someone else wrote in between, read again rather than overwrite them.
export async function mutateJSON<T>(p: string, seed: () => T, fn: (v: T) => T | void): Promise<T> {
  for (let i = 0; i < 10; i++) {
    const cur = await readJSON<T>(p);
    const base = cur ? cur.value : seed();
    const out = (fn(base) as T) ?? base;
    try { await writeBytes(p, JSON.stringify(out), "application/json", cur ? { ifMatch: cur.etag } : { createOnly: true }); return out; }
    catch (e) { if (!isConflict(e)) throw e; await new Promise(r => setTimeout(r, 120 * (i + 1) + Math.random() * 250)); }
  }
  throw new Error("Someone else kept saving at the same moment. Try again.");
}
export async function listPaths(prefix: string): Promise<string[]> {
  if (LOCAL) { const walk = async (d: string): Promise<string[]> => { const es = await fs.readdir(d, { withFileTypes: true }).catch(() => []); return (await Promise.all(es.map(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))).flat(); }; const root = path.join(process.cwd(), ".localstore"); return (await walk(path.join(root, prefix))).map(p => path.relative(root, p)); }
  const out: string[] = []; let cursor: string | undefined;
  do { const r = await list({ prefix, cursor, limit: 1000 }); out.push(...r.blobs.map(b => b.pathname)); cursor = r.hasMore ? r.cursor : undefined; } while (cursor);
  return out;
}
