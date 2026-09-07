import { EVENT_TYPE } from "./constants.js";
import { validateProtocolEvent, validateQualifiedWallet } from "./schemas.js";
export function qualifyBettingEvents(events, { excludedWallets = [] } = {}) {
  const excluded = new Set(excludedWallets);
  return events.map(validateProtocolEvent).filter((event) => event.txSuccess && event.eventType === EVENT_TYPE.BET && event.wallet && !excluded.has(event.wallet));
}
export function buildQualifiedWallets(events, options = {}) {
  const grouped = new Map();
  for (const event of qualifyBettingEvents(events, options)) {
    const key = `${event.startupId}:${event.sourceId}:${event.wallet}`;
    const row = grouped.get(key) ?? { startupId: event.startupId, sourceId: event.sourceId, wallet: event.wallet, timestamps: [], signatures: new Set(), eventCount: 0 };
    row.timestamps.push(event.blockTime); row.signatures.add(event.txSignature); row.eventCount += 1; grouped.set(key, row);
  }
  return [...grouped.values()].map((row) => validateQualifiedWallet({ startupId: row.startupId, sourceId: row.sourceId, wallet: row.wallet, firstSeen: row.timestamps.toSorted()[0], lastSeen: row.timestamps.toSorted().at(-1), transactionCount: row.signatures.size, eventCount: row.eventCount, qualifyingBetCount: row.eventCount, activeDays: new Set(row.timestamps.map((value) => value.slice(0, 10))).size }));
}
export function deduplicateWalletsAcrossSources(wallets, { validated = false } = {}) {
  if (!validated) throw new Error("cross-source wallet deduplication is disabled until methodology is validated");
  return new Set(wallets.map((wallet) => wallet.wallet)).size;
}