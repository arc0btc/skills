/**
 * Rune Transfer Builder
 *
 * Builds a transaction to transfer runes from one address to another.
 * Transaction structure:
 * - P2TR inputs: rune UTXOs (signed with taproot key)
 * - P2WPKH inputs: cardinal UTXOs for fees (signed with segwit key)
 * - OP_RETURN output: Runestone with edict + change pointer
 * - P2TR output: recipient receives runes
 * - P2TR output: rune change back to sender (if partial transfer)
 * - P2WPKH output: BTC change back to sender
 *
 * The Runestone includes a change pointer only when the change output is
 * actually included in the transaction.
 */

import * as btc from "@scure/btc-signer";
import type { Network } from "../config/networks.js";
import {
  P2WPKH_INPUT_VBYTES,
  P2WPKH_OUTPUT_VBYTES,
  P2TR_OUTPUT_VBYTES,
  P2TR_INPUT_BASE_VBYTES,
  TX_OVERHEAD_VBYTES,
  DUST_THRESHOLD,
} from "../config/bitcoin-constants.js";
import type { UTXO } from "../services/mempool-api.js";
import { buildRunestoneScript, parseRuneId, type RuneEdict } from "./runestone-builder.js";

export interface RuneTransferOptions {
  /** Rune ID (e.g., "840000:1") */
  runeId: string;
  /** Amount of runes to transfer (in smallest unit) */
  amount: bigint;
  /** Rune UTXOs containing the rune balance */
  runeUtxos: UTXO[];
  /** Cardinal UTXOs to pay fees */
  feeUtxos: UTXO[];
  /** Recipient address */
  recipientAddress: string;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** Sender's P2WPKH public key */
  senderPubKey: Uint8Array;
  /** Sender's Taproot internal public key (x-only, 32 bytes) */
  senderTaprootPubKey: Uint8Array;
  /** Sender's P2WPKH address for BTC change */
  senderAddress: string;
  /** Sender's Taproot address for rune change */
  senderTaprootAddress: string;
  /** Network */
  network: Network;
  /**
   * Total rune balance held across all runeUtxos (in smallest unit).
   * When amount < totalRuneAmount, a change output must be viable
   * (runeChangeSats >= DUST_THRESHOLD) — otherwise the builder throws
   * rather than silently burning the remaining runes.
   */
  totalRuneAmount: bigint;
}

export interface RuneTransferResult {
  tx: btc.Transaction;
  fee: number;
  btcChange: number;
  vsize: number;
  /** Indices of taproot inputs (rune UTXOs) */
  taprootInputIndices: number[];
  /** Indices of P2WPKH inputs (fee UTXOs) */
  feeInputIndices: number[];
}

function getBtcNetwork(network: Network): typeof btc.NETWORK {
  return network === "testnet" ? btc.TEST_NETWORK : btc.NETWORK;
}

// OP_RETURN output is ~40-80 bytes typically
const OP_RETURN_VBYTES = 50;

export function buildRuneTransfer(options: RuneTransferOptions): RuneTransferResult {
  const {
    runeId,
    amount,
    runeUtxos,
    feeUtxos,
    recipientAddress,
    feeRate,
    senderPubKey,
    senderTaprootPubKey,
    senderAddress,
    senderTaprootAddress,
    network,
    totalRuneAmount,
  } = options;

  if (runeUtxos.length === 0) {
    throw new Error("No rune UTXOs provided");
  }
  if (feeUtxos.length === 0) {
    throw new Error("No fee UTXOs provided");
  }
  if (feeRate <= 0) {
    throw new Error("Fee rate must be positive");
  }
  if (amount <= 0n) {
    throw new Error("Amount must be positive");
  }

  const btcNetwork = getBtcNetwork(network);
  const tx = new btc.Transaction();

  const { block, txIndex } = parseRuneId(runeId);

  // --- Inputs ---

  // Rune UTXOs (P2TR)
  const taprootPayment = btc.p2tr(senderTaprootPubKey, undefined, btcNetwork);
  const taprootInputIndices: number[] = [];

  for (let i = 0; i < runeUtxos.length; i++) {
    const utxo = runeUtxos[i];
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: taprootPayment.script,
        amount: BigInt(utxo.value),
      },
    });
    taprootInputIndices.push(i);
  }

  // Fee UTXOs (P2WPKH)
  const senderP2wpkh = btc.p2wpkh(senderPubKey, btcNetwork);
  const sortedFeeUtxos = [...feeUtxos]
    .filter((u) => u.status.confirmed)
    .sort((a, b) => b.value - a.value);

  if (sortedFeeUtxos.length === 0) {
    throw new Error("No confirmed fee UTXOs available");
  }

  // Select fee UTXOs
  let selectedFeeUtxos: UTXO[] = [];
  let feeTotal = 0;
  const feeInputIndices: number[] = [];

  for (const utxo of sortedFeeUtxos) {
    selectedFeeUtxos.push(utxo);
    feeTotal += utxo.value;

    // Output count: OP_RETURN + recipient + rune change + BTC change = 4
    const estimatedVsize =
      TX_OVERHEAD_VBYTES +
      runeUtxos.length * P2TR_INPUT_BASE_VBYTES +
      selectedFeeUtxos.length * P2WPKH_INPUT_VBYTES +
      OP_RETURN_VBYTES +
      P2TR_OUTPUT_VBYTES + // recipient
      P2TR_OUTPUT_VBYTES + // rune change
      P2WPKH_OUTPUT_VBYTES; // BTC change

    const estimatedFee = Math.ceil(estimatedVsize * feeRate);

    // Rune UTXOs' sats go to rune change, so fees come entirely from fee UTXOs
    if (feeTotal >= estimatedFee + DUST_THRESHOLD) {
      break;
    }
  }

  // Add fee inputs to transaction
  const feeInputStartIdx = runeUtxos.length;
  for (let i = 0; i < selectedFeeUtxos.length; i++) {
    const utxo = selectedFeeUtxos[i];
    tx.addInput({
      txid: utxo.txid,
      index: utxo.vout,
      witnessUtxo: {
        script: senderP2wpkh.script,
        amount: BigInt(utxo.value),
      },
    });
    feeInputIndices.push(feeInputStartIdx + i);
  }

  // --- Outputs ---
  // Output ordering matters for Runestone edict output references.
  //
  // Layout:
  //   Output 0: OP_RETURN Runestone
  //   Output 1: Recipient (receives transferred runes)
  //   Output 2: Rune change (remaining runes back to sender taproot)
  //   Output 3: BTC change (fee remainder back to sender segwit)

  // Compute rune change sats BEFORE building Runestone so we know whether to include change pointer
  const runeSats = runeUtxos.reduce((sum, u) => sum + u.value, 0);
  const runeChangeSats = Math.max(0, runeSats - DUST_THRESHOLD); // recipient gets dust from rune sats

  // Guard against silent rune burn on partial transfers with low-sat UTXOs.
  // When the change output cannot be included (runeChangeSats < DUST_THRESHOLD)
  // and this is a partial transfer (amount < totalRuneAmount), the remaining
  // runes have no destination and will burn per the Ordinals protocol.
  // Callers should consolidate rune UTXOs so they hold >= 2 * DUST_THRESHOLD sats
  // before attempting a partial transfer.
  if (amount < totalRuneAmount && runeChangeSats < DUST_THRESHOLD) {
    throw new Error(
      `Partial transfer would burn ${totalRuneAmount - amount} runes: rune UTXOs hold only ${runeSats} sats, ` +
        `which is insufficient to include a change output (need >= ${2 * DUST_THRESHOLD} sats). ` +
        `Consolidate rune UTXOs to hold more sats, or transfer the full balance of ${totalRuneAmount}.`
    );
  }

  // Build Runestone
  const edict: RuneEdict = {
    block,
    txIndex,
    amount,
    outputIndex: 1, // recipient is output 1
  };

  const runestoneScript = buildRunestoneScript({
    edict,
    changeOutput: runeChangeSats >= DUST_THRESHOLD ? 2 : undefined, // only set when the change output is included in the transaction
  });

  // Output 0: OP_RETURN
  tx.addOutput({
    script: runestoneScript,
    amount: 0n,
  });

  // Output 1: Recipient (dust amount to carry the runes)
  tx.addOutputAddress(recipientAddress, BigInt(DUST_THRESHOLD), btcNetwork);

  // Output 2: Rune change back to sender taproot
  // Carries remaining rune balance (Runestone change pointer = 2, only when the change output is included in the transaction)
  if (runeChangeSats >= DUST_THRESHOLD) {
    tx.addOutputAddress(senderTaprootAddress, BigInt(runeChangeSats), btcNetwork);
  }

  // Final fee calculation
  const actualOutputCount = 3 + (runeChangeSats >= DUST_THRESHOLD ? 1 : 0);
  const finalVsize =
    TX_OVERHEAD_VBYTES +
    runeUtxos.length * P2TR_INPUT_BASE_VBYTES +
    selectedFeeUtxos.length * P2WPKH_INPUT_VBYTES +
    OP_RETURN_VBYTES +
    (actualOutputCount - 1) * P2TR_OUTPUT_VBYTES + // non-OP_RETURN outputs
    P2WPKH_OUTPUT_VBYTES; // one P2WPKH change

  const finalFee = Math.ceil(finalVsize * feeRate);
  const btcChange = feeTotal - finalFee;

  if (btcChange < 0) {
    throw new Error(
      `Insufficient fee UTXOs: have ${feeTotal} sats, need ${finalFee} sats for fee`
    );
  }

  // Output 3: BTC change
  if (btcChange >= DUST_THRESHOLD) {
    tx.addOutputAddress(senderAddress, BigInt(btcChange), btcNetwork);
  }

  return {
    tx,
    fee: finalFee,
    btcChange: btcChange >= DUST_THRESHOLD ? btcChange : 0,
    vsize: Math.ceil(finalVsize),
    taprootInputIndices,
    feeInputIndices,
  };
}

/**
 * Sign a rune transfer transaction with mixed key types.
 */
export function signRuneTransfer(
  tx: btc.Transaction,
  taprootPrivateKey: Uint8Array,
  btcPrivateKey: Uint8Array,
  taprootInputIndices: number[],
  feeInputIndices: number[]
): { txHex: string; txid: string; vsize: number } {
  // Sign taproot inputs
  for (const idx of taprootInputIndices) {
    tx.signIdx(taprootPrivateKey, idx);
  }

  // Sign P2WPKH inputs
  for (const idx of feeInputIndices) {
    tx.signIdx(btcPrivateKey, idx);
  }

  tx.finalize();

  return {
    txHex: tx.hex,
    txid: tx.id,
    vsize: tx.vsize,
  };
}
