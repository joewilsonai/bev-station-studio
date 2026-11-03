// Pure text checks. Kim's words are canon: a line that is not hers is marked, never quietly accepted.
export function normalize(s: string): string {
  return s.toLowerCase()
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[—–]/g, "-").replace(/…/g, "...")
    .replace(/[*_\\#]/g, "").replace(/\s+/g, " ").trim();
}
const wordChar = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);
// True only when the whole line appears on word boundaries: "he" is not in "She."
export function inScript(line: string, script: string): boolean {
  const n = normalize(line); const hay = normalize(script);
  if (!n) return false;
  for (let i = hay.indexOf(n); i >= 0; i = hay.indexOf(n, i + 1)) {
    if (!(wordChar(hay[i - 1]) && wordChar(n[0])) && !(wordChar(hay[i + n.length]) && wordChar(n[n.length - 1]))) return true;
  }
  return false;
}
