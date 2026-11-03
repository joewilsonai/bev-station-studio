import { lookup } from "dns/promises";
import { isIP } from "net";
const MAX = 4.4e6;
export function isPrivateAddress(a: string): boolean {
  if (isIP(a) === 6) { const l = a.toLowerCase(); if (l.startsWith("::ffff:")) return isPrivateAddress(l.slice(7)); return l === "::1" || l === "::" || /^(fc|fd|fe[89ab])/.test(l); }
  const [p, q] = a.split(".").map(Number);
  return p === 0 || p === 10 || p === 127 || (p === 100 && q >= 64 && q <= 127) || (p === 169 && q === 254) || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || p >= 224;
}
// A picture or sound from a link: public https only, stopped as soon as it runs past the limit.
export async function fetchPublic(raw: string): Promise<{ data: Buffer; type: string }> {
  const u = new URL(raw); if (u.protocol !== "https:") throw new Error("The link has to be public and https.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true })).map(a => a.address);
  if (!addrs.length || addrs.some(isPrivateAddress)) throw new Error("The link has to be public and https.");
  const r = await fetch(u, { redirect: "error", signal: AbortSignal.timeout(20000) });
  if (!r.ok || !r.body) throw new Error(`That link answered ${r.status}.`);
  if (Number(r.headers.get("content-length") ?? 0) > MAX) throw new Error("That file is over 4 MB.");
  const parts: Uint8Array[] = []; let n = 0; const reader = r.body.getReader();
  for (;;) { const { done, value } = await reader.read(); if (done) break; n += value.length; if (n > MAX) { await reader.cancel(); throw new Error("That file is over 4 MB."); } parts.push(value); }
  return { data: Buffer.concat(parts), type: (r.headers.get("content-type") ?? "").split(";")[0] };
}
