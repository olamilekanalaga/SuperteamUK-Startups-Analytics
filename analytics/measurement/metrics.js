import { EVENT_TYPE, METRIC_STATUS } from "./constants.js";
import { validateMetricSnapshot, validateProtocolEvent } from "./schemas.js";
import { buildQualifiedWallets } from "./wallets.js";
export const METRIC_REGISTRY = Object.freeze({
  unique_betting_wallets: { unit: "wallets", grain: "period", evidence: "proxy", description: "Distinct qualified betting wallets; not verified humans." },
  qualifying_bet_transactions: { unit: "transactions", grain: "period", evidence: "derived", description: "Distinct successful transactions containing qualifying bet events." },
  betting_volume: { unit: "token", grain: "period", evidence: "derived", description: "Sum of qualifying stake amounts only; settlements and payouts are excluded." },
  average_bet_size: { unit: "token", grain: "period", evidence: "derived", description: "Mean qualifying stake amount." },
  median_bet_size: { unit: "token", grain: "period", evidence: "derived", description: "Median qualifying stake amount." },
  minimum_bet_size: { unit: "token", grain: "period", evidence: "derived", description: "Minimum qualifying stake amount." },
  maximum_bet_size: { unit: "token", grain: "period", evidence: "derived", description: "Maximum qualifying stake amount." },
  new_betting_wallets: { unit: "wallets", grain: "period", evidence: "derived", description: "Qualified wallets first observed in the period." },
  returning_betting_wallets: { unit: "wallets", grain: "period", evidence: "derived", description: "Qualified wallets first observed before the period and active during it." },
  repeat_wallet_rate: { unit: "percent", grain: "period", evidence: "derived", description: "Share of qualified wallets active on more than one day." },
  d1_retention: { unit: "percent", grain: "cohort", evidence: "derived", description: "Eligible first-use cohorts returning on day 1." },
  d7_retention: { unit: "percent", grain: "cohort", evidence: "derived", description: "Eligible first-use cohorts returning within seven days." },
  d30_retention: { unit: "percent", grain: "cohort", evidence: "derived", description: "Eligible first-use cohorts returning within thirty days." },
  top_1_wallet_transaction_share: { unit: "percent", grain: "period", evidence: "derived", description: "Largest qualified wallet share of qualifying transactions." },
  top_5_wallet_transaction_share: { unit: "percent", grain: "period", evidence: "derived", description: "Top five qualified wallets' share of qualifying transactions." },
  top_10_wallet_transaction_share: { unit: "percent", grain: "period", evidence: "derived", description: "Top ten qualified wallets' share of qualifying transactions." },
  top_1_wallet_volume_share: { unit: "percent", grain: "period", evidence: "derived", description: "Largest qualified wallet share of qualifying stake volume." },
  top_5_wallet_volume_share: { unit: "percent", grain: "period", evidence: "derived", description: "Top five qualified wallets' share of qualifying stake volume." },
  top_10_wallet_volume_share: { unit: "percent", grain: "period", evidence: "derived", description: "Top ten qualified wallets' share of qualifying stake volume." },
  median_wallet_volume: { unit: "token", grain: "period", evidence: "derived", description: "Median qualifying stake volume per wallet." },
});
export class MetricCalculator {
  constructor({ name, calculate }) {
    if (!METRIC_REGISTRY[name]) throw new TypeError(`Unknown metric: ${name}`);
    if (typeof calculate !== "function") throw new TypeError("Metric calculator requires a calculate function");
    this.name = name;
    this.calculate = calculate;
  }
}
const median = (numbers) => { if (!numbers.length) return null; const sorted = numbers.toSorted((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const share = (numbers, count) => { const total = numbers.reduce((sum, value) => sum + value, 0); return total ? (numbers.toSorted((a, b) => b - a).slice(0, count).reduce((sum, value) => sum + value, 0) / total) * 100 : null; };
export function calculatePurebetMetrics(events, { excludedWallets = [] } = {}) {
  const bets = events.map(validateProtocolEvent).filter((event) => event.txSuccess && event.eventType === EVENT_TYPE.BET && !excludedWallets.includes(event.wallet));
  if (!bets.length) return { metrics: {}, wallets: [], status: "empty", reason: "No qualifying production events loaded" };
  const wallets = buildQualifiedWallets(bets);
  const stakes = bets.filter((event) => event.amount != null).map((event) => event.amount);
  const walletVolumes = new Map();
  for (const event of bets) if (event.amount != null) walletVolumes.set(event.wallet, (walletVolumes.get(event.wallet) ?? 0) + event.amount);
  const completeStakes = stakes.length === bets.length;
  const txCounts = wallets.map((wallet) => wallet.transactionCount);
  const volumes = [...walletVolumes.values()];
  return { status: "available", wallets, metrics: {
    unique_betting_wallets: wallets.length,
    qualifying_bet_transactions: new Set(bets.map((event) => event.txSignature)).size,
    betting_volume: completeStakes ? stakes.reduce((sum, value) => sum + value, 0) : null,
    average_bet_size: completeStakes ? stakes.reduce((sum, value) => sum + value, 0) / stakes.length : null,
    median_bet_size: completeStakes ? median(stakes) : null,
    minimum_bet_size: completeStakes ? Math.min(...stakes) : null,
    maximum_bet_size: completeStakes ? Math.max(...stakes) : null,
    repeat_wallet_rate: wallets.length ? (wallets.filter((wallet) => wallet.activeDays > 1).length / wallets.length) * 100 : null,
    top_1_wallet_transaction_share: share(txCounts, 1),
    top_5_wallet_transaction_share: share(txCounts, 5),
    top_10_wallet_transaction_share: share(txCounts, 10),
    top_1_wallet_volume_share: completeStakes ? share(volumes, 1) : null,
    top_5_wallet_volume_share: completeStakes ? share(volumes, 5) : null,
    top_10_wallet_volume_share: completeStakes ? share(volumes, 10) : null,
    median_wallet_volume: completeStakes ? median(volumes) : null,
  }};
}
export function createMetricSnapshots({ startupId, sourceId, period, periodStart, periodEnd, metrics, calculatedAt, methodologyVersion = "purebet-v1" }) {
  return Object.entries(METRIC_REGISTRY).map(([metricName, definition]) => {
    const value = metrics[metricName] ?? null;
    return validateMetricSnapshot({ startupId, sourceId, metricName, period, periodStart, periodEnd, value, status: value === null ? METRIC_STATUS.NOT_AVAILABLE : METRIC_STATUS.AVAILABLE, unit: definition.unit, evidenceType: definition.evidence, methodologyVersion, calculatedAt, notes: value === null ? "Not calculated from the loaded evidence; this is not a measured zero." : definition.description });
  });
}