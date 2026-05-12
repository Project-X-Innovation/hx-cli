import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { strict as assert } from "node:assert";
import { matchTicket, extractTicketRef, resolveTicket } from "./resolve-ticket.js";
import type { HxConfig } from "./config.js";

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

describe("resolveTicket", () => {
  const fakeConfig: HxConfig = {
    apiKey: "hxi_test",
    url: "https://example.com",
    orgName: "test-org",
  };

  const activeTickets = [
    { id: "cm1active001", shortId: "BLD-100" },
    { id: "cm1active002", shortId: "BLD-200" },
  ];

  const archivedTickets = [
    { id: "cm2archived001", shortId: "ARC-300" },
    { id: "cm2archived002", shortId: "ARC-400" },
  ];

  /**
   * Create a mock fetchFn that returns different item arrays for
   * active (no queryParams.archived) vs archived (queryParams.archived === "true") calls.
   */
  function createMockFetch(
    activeItems: Array<{ id: string; shortId: string }>,
    archivedItems: Array<{ id: string; shortId: string }>,
  ) {
    const fn = mock.fn(
      async (
        _config: HxConfig,
        _path: string,
        options?: { queryParams?: Record<string, string> },
      ) => {
        if (options?.queryParams?.archived === "true") {
          return { items: archivedItems };
        }
        return { items: activeItems };
      },
    );
    return fn;
  }

  it("resolves archived ticket by internal ID", async () => {
    const mockFetch = createMockFetch([], archivedTickets);
    const result = await resolveTicket(fakeConfig, "cm2archived001", {
      fetchFn: mockFetch as typeof import("./http.js").hxFetch,
    });
    assert.deepStrictEqual(result, { id: "cm2archived001", shortId: "ARC-300" });
  });

  it("resolves archived ticket by short ID", async () => {
    const mockFetch = createMockFetch([], archivedTickets);
    const result = await resolveTicket(fakeConfig, "ARC-300", {
      fetchFn: mockFetch as typeof import("./http.js").hxFetch,
    });
    assert.deepStrictEqual(result, { id: "cm2archived001", shortId: "ARC-300" });
  });

  it("resolves archived ticket by numeric ticket number", async () => {
    const mockFetch = createMockFetch([], archivedTickets);
    const result = await resolveTicket(fakeConfig, "300", {
      fetchFn: mockFetch as typeof import("./http.js").hxFetch,
    });
    assert.deepStrictEqual(result, { id: "cm2archived001", shortId: "ARC-300" });
  });

  it("active match takes priority over archived (no archived fetch)", async () => {
    const mockFetch = createMockFetch(activeTickets, archivedTickets);
    const result = await resolveTicket(fakeConfig, "BLD-100", {
      fetchFn: mockFetch as typeof import("./http.js").hxFetch,
    });
    assert.deepStrictEqual(result, { id: "cm1active001", shortId: "BLD-100" });
    // Mock was called only once (active fetch); no archived fetch occurred
    assert.strictEqual(mockFetch.mock.callCount(), 1);
  });

  it("returns not-found error for missing ticket", async () => {
    const mockFetch = createMockFetch(activeTickets, archivedTickets);
    await assert.rejects(
      () =>
        resolveTicket(fakeConfig, "NONEXISTENT-999", {
          fetchFn: mockFetch as typeof import("./http.js").hxFetch,
        }),
      (err: Error) => {
        assert.ok(err.message.includes("not found"));
        return true;
      },
    );
  });

  it("detects cross-set numeric ambiguity", async () => {
    // Active has BLD-42, archived has ARC-42 — numeric ref "42" is ambiguous across sets
    const activeWithNum = [{ id: "cm1active003", shortId: "BLD-42" }];
    const archivedWithNum = [{ id: "cm2archived003", shortId: "ARC-42" }];
    const mockFetch = createMockFetch(activeWithNum, archivedWithNum);
    await assert.rejects(
      () =>
        resolveTicket(fakeConfig, "42", {
          fetchFn: mockFetch as typeof import("./http.js").hxFetch,
        }),
      (err: Error) => {
        assert.ok(err.message.includes("Ambiguous"));
        return true;
      },
    );
  });

  it("resolves archived-only ticket (regression test)", async () => {
    // Active is empty; only the archived set has a ticket
    const mockFetch = createMockFetch([], [{ id: "cm2onlyarchived", shortId: "ONLY-1" }]);
    const result = await resolveTicket(fakeConfig, "ONLY-1", {
      fetchFn: mockFetch as typeof import("./http.js").hxFetch,
    });
    assert.deepStrictEqual(result, { id: "cm2onlyarchived", shortId: "ONLY-1" });
  });

  it("archived fetch failure produces resolution-stage error", async () => {
    // Active fetch succeeds (no match), archived fetch throws
    const fn = mock.fn(
      async (
        _config: HxConfig,
        _path: string,
        options?: { queryParams?: Record<string, string> },
      ) => {
        if (options?.queryParams?.archived === "true") {
          throw new Error("Network timeout");
        }
        return { items: [] };
      },
    );
    await assert.rejects(
      () =>
        resolveTicket(fakeConfig, "ARC-300", {
          fetchFn: fn as typeof import("./http.js").hxFetch,
        }),
      (err: Error) => {
        assert.ok(err.message.includes("Failed to fetch archived ticket list for resolution"));
        assert.ok(!err.message.includes("not found"));
        return true;
      },
    );
  });

  it("active fetch failure propagates error", async () => {
    const fn = mock.fn(async () => {
      throw new Error("Server unavailable");
    });
    await assert.rejects(
      () =>
        resolveTicket(fakeConfig, "BLD-100", {
          fetchFn: fn as typeof import("./http.js").hxFetch,
        }),
      (err: Error) => {
        assert.ok(err.message.includes("Failed to fetch ticket list for resolution"));
        // Ensure it's not the archived variant
        assert.ok(!err.message.includes("archived"));
        return true;
      },
    );
  });
});
