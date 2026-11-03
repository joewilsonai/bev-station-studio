import test from "node:test"; import assert from "node:assert";
import { inScript } from "../lib/canon.ts";
import { isPrivateAddress } from "../lib/fetch-public.ts";
test("a line must be word for word, on word boundaries", () => { assert.equal(inScript("he","She."),false); assert.equal(inScript("Yes.","TRAINER: Yes.\n"),true); assert.equal(inScript("It’s not a C.","**PEN:** It's not a C. I know"),true); assert.equal(inScript("","Yes."),false); });
test("private addresses are refused", () => { for (const a of ["127.0.0.1","10.1.1.1","172.16.0.1","192.168.1.1","169.254.169.254","::1","fd00::1"]) assert.equal(isPrivateAddress(a),true,a); assert.equal(isPrivateAddress("8.8.8.8"),false); });
