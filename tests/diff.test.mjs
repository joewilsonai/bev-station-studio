import test from "node:test"; import assert from "node:assert";
import { restoreOrder, shotChanges, undoFields, showValue } from "../lib/diff.ts";
const base = { id:"a", desc:"old", cast:["pen"], lines:[{who:"pen",kind:"aloud",text:"Hi"}], seconds:3, status:"idea", takes:[], by:"x", at:"t" };
test("records only what changed, with before and after", () => { const c = shotChanges(base,{...base,desc:"new"}); assert.deepEqual(c,[{field:"desc",before:"old",after:"new"}]); });
test("counts new takes", () => { const c = shotChanges(base,{...base,takes:[{id:"t"}]}); assert.equal(c[0].field,"takes"); assert.equal(c[0].after,1); });
test("undo leaves later edits and takes alone", () => { const s = {...base,desc:"new",seconds:9,takes:[{id:"t"}]}; undoFields(s,[{field:"desc",before:"old",after:"new"},{field:"takes",before:0,after:1}]); assert.equal(s.desc,"old"); assert.equal(s.seconds,9); assert.equal(s.takes.length,1); });
test("undo clears a field that was empty before", () => { const s = {...base,note:"x"}; undoFields(s,[{field:"note",before:null,after:"x"}]); assert.equal("note" in s,false); });
test("shows lines readably", () => assert.equal(showValue("lines",base.lines),"pen: Hi"));
test("undoing a reorder leaves newer shots in place", () => { const ids = restoreOrder([{id:"b"},{id:"c"},{id:"a"}],["a","b"]).map(x=>x.id); assert.deepEqual(ids,["a","c","b"]); });
