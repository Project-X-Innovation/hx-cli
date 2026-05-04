import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { isHelpRequested, hasFlag, getFlag, getPositionalArgs } from "./flags.js";

describe("isHelpRequested", () => {
  it('returns true for ["--help"]', () => {
    assert.strictEqual(isHelpRequested(["--help"]), true);
  });

  it('returns true for ["-h"]', () => {
    assert.strictEqual(isHelpRequested(["-h"]), true);
  });

  it('returns true for ["get", "--help"]', () => {
    assert.strictEqual(isHelpRequested(["get", "--help"]), true);
  });

  it('returns true for ["get", "-h"]', () => {
    assert.strictEqual(isHelpRequested(["get", "-h"]), true);
  });

  it('returns false for ["get", "339"]', () => {
    assert.strictEqual(isHelpRequested(["get", "339"]), false);
  });

  it("returns false for empty array", () => {
    assert.strictEqual(isHelpRequested([]), false);
  });

  it('returns false for ["--json"]', () => {
    assert.strictEqual(isHelpRequested(["--json"]), false);
  });
});

describe("hasFlag", () => {
  it("returns true when flag is present", () => {
    assert.strictEqual(hasFlag(["--json", "339"], "--json"), true);
  });

  it("returns false when flag is absent", () => {
    assert.strictEqual(hasFlag(["339"], "--json"), false);
  });
});

describe("getFlag", () => {
  it("returns flag value", () => {
    assert.strictEqual(getFlag(["--ticket", "abc123"], "--ticket"), "abc123");
  });

  it("returns undefined when flag is missing", () => {
    assert.strictEqual(getFlag(["339"], "--ticket"), undefined);
  });

  it("returns undefined when flag has no value", () => {
    assert.strictEqual(getFlag(["--ticket"], "--ticket"), undefined);
  });
});

describe("getPositionalArgs", () => {
  it("returns positional args excluding flags", () => {
    const result = getPositionalArgs(["339", "--repo", "my-app", "extra"], ["--repo"]);
    assert.deepStrictEqual(result, ["339", "extra"]);
  });

  it("returns empty array when all args are flags", () => {
    const result = getPositionalArgs(["--repo", "my-app"], ["--repo"]);
    assert.deepStrictEqual(result, []);
  });
});
