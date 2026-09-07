import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_CONFIDENCE, EVENT_TYPE, METRIC_STATUS } from "../analytics/measurement/constants.js";
import { buildFrontendMeasurementContract } from "../analytics/measurement/frontend-contract.js";
import { IngestionAdapter, ingestTransactions } from "../analytics/measurement/ingestion.js";
import { calculatePurebetMetrics, createMetricSnapshots, METRIC_REGISTRY } from "../analytics/measurement/metrics.js";
import { validateMetricSnapshot, validateProtocolEvent, validateRawTransaction } from "../analytics/measurement/schemas.js";
import { buildQualifiedWallets, deduplicateWalletsAcrossSources } from "../analytics/measurement/wallets.js";
import { PUREBET_CONFIG } from "../analytics/purebet/config.js";
import { runPurebetMeasurement } from "../analytics/purebet/pipeline.js";
const at = "2026-01-08T12:00:00.000Z";
const event = ({ id, wallet, amount, type = EVENT_TYPE.BET, sourceId = "purebet-current-program", tx = `tx-${id}`, day = 8 }) => validateProtocolEvent({
  eventId: id, startupId: "STUK-008", sourceId, txSignature: tx, blockTime: `2026-01-${String(day).padStart(2, "0")}T12:00:00.000Z`, txSuccess: true, wallet, eventType: type, amount,
  token: "synthetic-test-token", tokenDecimals: 6, usdValue: null, programId: sourceId === "purebet-current-program" ? PUREBET_CONFIG.sources[0].address : PUREBET_CONFIG.sources[1].address,
  instructionIndex: 0, innerInstructionIndex: null, rawTokenAmount: amount == null ? null : String(amount * 1_000_000), decoderVersion: "test-only-v1", confidence: EVENT_CONFIDENCE.HIGH, metadata: { synthetic: true },
});
test("Purebet config preserves partial attribution and exact sources", () => {
  assert.equal(PUREBET_CONFIG.startup.attributionState, "partial");
  assert.equal(PUREBET_CONFIG.crossProgramDeduplicationValidated, false);
  assert.equal(PUREBET_CONFIG.productionDataLoaded, false);
  assert.deepEqual(PUREBET_CONFIG.sources.map(({ id, address }) => [id, address]), [
    ["purebet-current-program", "9bB3TADcwZEweUUcrp46FEpwMfLbwkEFQnc4patHPApp"],
    ["purebet-legacy-program", "39mBcnQ27QA9nNZmM6VrumE2vtqs5v3HD7t7RGv9kXUV"],
    ["purebet-legacy-program-data", "7Z3XMqoZfjom2CArncLmqSbhQVB5vKfApxdCt8qoyW4Q"],
  ]);
});
test("zero production rows are empty-safe and never fake zero", () => {
  const output = runPurebetMeasurement({ eventsBySource: {}, period: { name: "day", start: "2026-01-01T00:00:00.000Z", end: "2026-01-02T00:00:00.000Z" }, calculatedAt: at });
  assert.equal(output.frontend.empty, true); assert.deepEqual(output.frontend.metrics, []); assert.equal(output.combined.status, "disabled");
  for (const source of output.sources) for (const snapshot of source.snapshots) { assert.equal(snapshot.status, METRIC_STATUS.NOT_AVAILABLE); assert.equal(snapshot.value, null); }
});
test("wallets require bet events and configured exclusions apply", () => {
  const events = [event({ id: "1", wallet: "wallet-a", amount: 10 }), event({ id: "2", wallet: "wallet-a", amount: 20, day: 9 }), event({ id: "3", wallet: "protocol", amount: 50 }), event({ id: "4", wallet: "wallet-b", amount: 100, type: EVENT_TYPE.PAYOUT })];
  assert.deepEqual(buildQualifiedWallets(events, { excludedWallets: ["protocol"] }).map(({ wallet, qualifyingBetCount, activeDays }) => [wallet, qualifyingBetCount, activeDays]), [["wallet-a", 2, 2]]);
});
test("volume counts qualifying stakes, never payouts or settlements", () => {
  const result = calculatePurebetMetrics([event({ id: "1", wallet: "wallet-a", amount: 100 }), event({ id: "2", wallet: "wallet-a", amount: 180, type: EVENT_TYPE.PAYOUT }), event({ id: "3", wallet: "wallet-b", amount: 50 }), event({ id: "4", wallet: "wallet-b", amount: 70, type: EVENT_TYPE.SETTLEMENT })]);
  assert.equal(result.metrics.betting_volume, 150); assert.equal(result.metrics.qualifying_bet_transactions, 2); assert.equal(result.metrics.unique_betting_wallets, 2);
});
test("missing stakes yield unknown volume, not zero", () => {
  const result = calculatePurebetMetrics([event({ id: "1", wallet: "wallet-a", amount: null })]);
  const snapshots = createMetricSnapshots({ startupId: "STUK-008", sourceId: "purebet-current-program", period: "day", periodStart: "2026-01-08T00:00:00.000Z", periodEnd: "2026-01-09T00:00:00.000Z", metrics: result.metrics, calculatedAt: at });
  const volume = snapshots.find((snapshot) => snapshot.metricName === "betting_volume");
  assert.equal(volume.value, null); assert.equal(volume.status, METRIC_STATUS.NOT_AVAILABLE);
});
test("concentration derives from qualified events", () => {
  const result = calculatePurebetMetrics([event({ id: "1", wallet: "wallet-a", amount: 10 }), event({ id: "2", wallet: "wallet-a", amount: 20 }), event({ id: "3", wallet: "wallet-a", amount: 30 }), event({ id: "4", wallet: "wallet-b", amount: 40 })]);
  assert.equal(result.metrics.top_1_wallet_transaction_share, 75); assert.equal(result.metrics.top_1_wallet_volume_share, 60); assert.equal(result.metrics.median_wallet_volume, 50);
});
test("current and legacy remain distinct and deduplication is guarded", () => {
  const current = buildQualifiedWallets([event({ id: "1", wallet: "same-wallet", amount: 10 })]);
  const legacy = buildQualifiedWallets([event({ id: "2", wallet: "same-wallet", amount: 20, sourceId: "purebet-legacy-program" })]);
  assert.notEqual(current[0].sourceId, legacy[0].sourceId);
  assert.throws(() => deduplicateWalletsAcrossSources([...current, ...legacy]), /disabled until methodology is validated/u);
  assert.equal(deduplicateWalletsAcrossSources([...current, ...legacy], { validated: true }), 1);
});
test("raw schema validates timestamps, shape, provenance, and immutability", () => {
  const raw = validateRawTransaction({ txSignature: "synthetic", slot: 1, blockTime: at, success: true, fee: 5000, feePayer: "payer", signers: ["payer"], programId: PUREBET_CONFIG.sources[0].address, instructions: [], sourceMethod: "synthetic-test-adapter", retrievedAt: at });
  assert.equal(Object.isFrozen(raw), true); assert.throws(() => validateRawTransaction({ ...raw, slot: -1 }), /slot/u);
  assert.throws(() => validateProtocolEvent({ ...event({ id: "bad", wallet: "wallet", amount: 1 }), tokenDecimals: -1 }), /tokenDecimals/u);
});
test("ingestion rejects duplicate signatures within one source", async () => {
  class TestAdapter extends IngestionAdapter { async fetchTransactions() { const row = { txSignature: "duplicate", slot: 1, blockTime: at, success: true, fee: 1, feePayer: "payer", signers: ["payer"], programId: PUREBET_CONFIG.sources[0].address, instructions: [], sourceMethod: "synthetic-test-adapter", retrievedAt: at }; return [row, row]; } }
  await assert.rejects(() => ingestTransactions({ adapter: new TestAdapter("test"), source: PUREBET_CONFIG.sources[0], window: { from: at, to: "2026-01-09T12:00:00.000Z" } }), /duplicate raw transaction/u);
});
test("failed normalized events are excluded from business metrics", () => {
  const failed = { ...event({ id: "failed", wallet: "wallet-a", amount: 100 }), txSuccess: false };
  assert.equal(calculatePurebetMetrics([failed]).status, "empty");
});

test("snapshot schema rejects fake zero when unavailable", () => {
  assert.throws(() => validateMetricSnapshot({ startupId: "STUK-008", sourceId: "purebet-current-program", metricName: "betting_volume", period: "day", periodStart: at, periodEnd: "2026-01-09T12:00:00.000Z", value: 0, status: METRIC_STATUS.NOT_AVAILABLE, unit: "token", methodologyVersion: "purebet-v1", calculatedAt: at }), /must be null/u);
});
test("frontend contract exposes only available metrics and required caveats", () => {
  const contract = buildFrontendMeasurementContract({ startup: PUREBET_CONFIG.startup, sources: PUREBET_CONFIG.sources, snapshots: [], generatedAt: at });
  assert.equal(contract.empty, true); assert.match(contract.disclaimers.join(" "), /not verified human users/u); assert.match(contract.disclaimers.join(" "), /qualifying stakes only/u);
  assert.ok(Object.keys(METRIC_REGISTRY).includes("d30_retention"));
});