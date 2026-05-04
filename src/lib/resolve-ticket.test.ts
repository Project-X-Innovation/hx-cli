import { describe, it, beforeEach, afterEach } from "node:test";
import { strict as assert } from "node:assert";
import { matchTicket, extractTicketRef } from "./resolve-ticket.js";

describe("matchTicket", () => {
  const items = [
    { id: "cm1abc123def456", shortId: "BLD-339" },
    { id: "cm2xyz789ghi012", shortId: "BLD-340" },
    { id: "cm3jkl345mno678", shortId: "HLX-42" },
  ];

  it("matches by exact internal ID", () => {
    const result = matchTicket(items, "cm1abc123def456");
    assert.deepStrictEqual(result, { id: "cm1abc123def456", shortId: "BLD-339" });
  });

  it("matches by exact short ID (case-insensitive)", () => {
    const result = matchTicket(items, "bld-339");
    assert.deepStrictEqual(result, { id: "cm1abc123def456", shortId: "BLD-339" });
  });

  it("matches by exact short ID (exact case)", () => {
    const result = matchTicket(items, "BLD-339");
    assert.deepStrictEqual(result, { id: "cm1abc123def456", shortId: "BLD-339" });
  });

  it("matches by numeric ticket number", () => {
    const result = matchTicket(items, "339");
    assert.deepStrictEqual(result, { id: "cm1abc123def456", shortId: "BLD-339" });
  });

  it("matches numeric ticket number 42", () => {
    const result = matchTicket(items, "42");
    assert.deepStrictEqual(result, { id: "cm3jkl345mno678", shortId: "HLX-42" });
  });

  it("returns null when no match found", () => {
    const result = matchTicket(items, "999");
    assert.strictEqual(result, null);
  });

  it("returns null for ambiguous numeric match", () => {
    const ambiguousItems = [
      { id: "id1", shortId: "ABC-1" },
      { id: "id2", shortId: "DEF-1" },
    ];
    const result = matchTicket(ambiguousItems, "1");
    assert.strictEqual(result, null);
  });

  it("returns null for empty items array", () => {
    const result = matchTicket([], "339");
    assert.strictEqual(result, null);
  });

  it("exact ID takes priority over numeric match", () => {
    // Edge case: if a CUID happens to be a numeric string
    const edgeItems = [
      { id: "339", shortId: "TEST-100" },
      { id: "other", shortId: "BLD-339" },
    ];
    const result = matchTicket(edgeItems, "339");
    // Should match by exact ID, not by numeric suffix
    assert.deepStrictEqual(result, { id: "339", shortId: "TEST-100" });
  });

  it("returns null for non-matching string", () => {
    const result = matchTicket(items, "nonexistent");
    assert.strictEqual(result, null);
  });
});

describe("extractTicketRef", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.HELIX_TICKET_ID;
    delete process.env.HELIX_TICKET_ID;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.HELIX_TICKET_ID = originalEnv;
    } else {
      delete process.env.HELIX_TICKET_ID;
    }
  });

  it("extracts --ticket flag value", () => {
    const result = extractTicketRef(["--ticket", "cm1abc123"]);
    assert.strictEqual(result, "cm1abc123");
  });

  it("falls back to HELIX_TICKET_ID env var", () => {
    process.env.HELIX_TICKET_ID = "env-ticket-id";
    const result = extractTicketRef([]);
    assert.strictEqual(result, "env-ticket-id");
  });

  it("falls back to first positional arg", () => {
    const result = extractTicketRef(["339"]);
    assert.strictEqual(result, "339");
  });

  it("skips flag-prefixed args to find positional", () => {
    const result = extractTicketRef(["--json", "BLD-339"]);
    assert.strictEqual(result, "BLD-339");
  });

  it("--ticket flag takes priority over env var", () => {
    process.env.HELIX_TICKET_ID = "env-ticket-id";
    const result = extractTicketRef(["--ticket", "flag-ticket-id"]);
    assert.strictEqual(result, "flag-ticket-id");
  });

  it("--ticket flag takes priority over positional", () => {
    const result = extractTicketRef(["BLD-339", "--ticket", "flag-ticket-id"]);
    assert.strictEqual(result, "flag-ticket-id");
  });
});
