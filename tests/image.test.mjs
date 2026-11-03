import test from "node:test"; import assert from "node:assert"; import fs from "node:fs";
const src = fs.readFileSync("lib/image.ts","utf8"); const re = new RegExp(src.match(/const SEXUAL = \/(.*)\/i;/)[1],"i");
test("sexual requests are blocked", () => { for (const t of ["topless at the bar","make her naked","sexy pose","explicit shot"]) assert.ok(re.test(t),t); });
test("ordinary directions pass", () => { for (const t of ["She cringes, visibly","Close on her hands rolling silverware"]) assert.ok(!re.test(t),t); });
