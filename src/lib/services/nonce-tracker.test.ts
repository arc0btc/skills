/**
 * Tests for the nonce-tracker anti-clobber guards.
 *
 * Regression coverage for the 2026-07-16 incident where an empty-account body
 * (returned when the shared tracker was queried against the wrong network —
 * NETWORK defaults to testnet — for a mainnet address) clobbered a healthy
 * nextNonce ~985 down to 1, causing guaranteed BadNonce on every send.
 * @see https://github.com/aibtcdev/skills/issues/240
 */

import { describe, expect, test } from "bun:test";
import { _testing, type AddressNonceState } from "./nonce-tracker.js";
import { type NonceInfo } from "./hiro-api.js";

const { maxPendingNonce, isLocallyImplausible, isTrustworthyHiroSync } = _testing;

function entry(overrides: Partial<AddressNonceState> = {}): AddressNonceState {
  return {
    nextNonce: 985,
    lastUpdated: "2026-07-16T19:00:00.000Z",
    lastSynced: "2026-07-16T19:00:00.000Z",
    lastExecutedNonce: 977,
    mempoolPending: 3,
    pending: [
      { nonce: 984, txid: "a", timestamp: "2026-07-16T18:00:00.000Z" },
      { nonce: 986, txid: "b", timestamp: "2026-07-16T18:01:00.000Z" },
    ],
    ...overrides,
  };
}

// The empty-account body testnet returns for a mainnet address.
const EMPTY_ACCOUNT: Pick<NonceInfo, "possible_next_nonce" | "last_executed_tx_nonce"> = {
  possible_next_nonce: 0,
  last_executed_tx_nonce: null as unknown as number,
};

const HEALTHY: Pick<NonceInfo, "possible_next_nonce" | "last_executed_tx_nonce"> = {
  possible_next_nonce: 985,
  last_executed_tx_nonce: 977,
};

describe("maxPendingNonce", () => {
  test("returns highest broadcast nonce", () => {
    expect(maxPendingNonce(entry())).toBe(986);
  });
  test("returns 0 with empty log", () => {
    expect(maxPendingNonce(entry({ pending: [] }))).toBe(0);
  });
});

describe("isLocallyImplausible", () => {
  test("flags a poisoned entry (nextNonce=1, broadcast up to 986)", () => {
    expect(isLocallyImplausible(entry({ nextNonce: 1 }))).toBe(true);
  });
  test("accepts a healthy entry at chain tip", () => {
    expect(isLocallyImplausible(entry({ nextNonce: 985 }))).toBe(false);
  });
  test("tolerates nextNonce just below max broadcast (dropped tail tx)", () => {
    expect(isLocallyImplausible(entry({ nextNonce: 985 }))).toBe(false); // 985 >= 986-5
  });
});

describe("isTrustworthyHiroSync", () => {
  test("rejects empty-account body against known higher state", () => {
    expect(isTrustworthyHiroSync(EMPTY_ACCOUNT, entry())).toBe(false);
  });
  test("rejects a large backward jump", () => {
    expect(
      isTrustworthyHiroSync({ possible_next_nonce: 10, last_executed_tx_nonce: 9 }, entry())
    ).toBe(false);
  });
  test("accepts a healthy in-range response", () => {
    expect(isTrustworthyHiroSync(HEALTHY, entry())).toBe(true);
  });
  test("tolerates a shallow reorg within tolerance", () => {
    expect(
      isTrustworthyHiroSync({ possible_next_nonce: 982, last_executed_tx_nonce: 981 }, entry())
    ).toBe(true);
  });
  test("accepts any response when there is no prior state", () => {
    expect(isTrustworthyHiroSync(EMPTY_ACCOUNT, undefined)).toBe(true);
  });
  test("accepts empty-account body for a genuinely new address (nextNonce<=1)", () => {
    expect(isTrustworthyHiroSync(EMPTY_ACCOUNT, entry({ nextNonce: 1, pending: [] }))).toBe(true);
  });
});
