import { NextRequest, NextResponse } from "next/server";
// One secret link per person. Open it once and this browser stays in for a year.
export function proxy(req: NextRequest) {
  const kim = process.env.KIM_TOKEN, joe = process.env.JOE_TOKEN;
  if (!kim || !joe) {
    if (process.env.VERCEL) return new NextResponse("The studio is not configured.", { status: 503 });
    return NextResponse.next();
  }
  // The connector route checks its own token. Connector apps also probe these well-known paths for
  // a login; they must get a plain 404, not a 401, or the app starts a sign-in that can never finish.
  const path = req.nextUrl.pathname;
  if (path.startsWith("/m/") || path.startsWith("/.well-known/") || /^\/(register|authorize|token)\/?$/.test(path)) return NextResponse.next();
  const k = req.nextUrl.searchParams.get("k");
  if (k && (k === kim || k === joe)) {
    const url = req.nextUrl.clone(); url.searchParams.delete("k");
    const res = NextResponse.redirect(url);
    res.cookies.set("studio", k, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
    return res;
  }
  const c = req.cookies.get("studio")?.value;
  if (c === kim || c === joe) return NextResponse.next();
  return new NextResponse(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>Studio</title><body style="font:18px system-ui;margin:15vh auto;max-width:30em;padding:0 20px;color:#40111c">This studio opens from your private link. Find it in your texts and open it once on this device. It stays open after that.</body>`,
    { status: 401, headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" } });
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
