export const FRONTEND_CONTRACT_VERSION = "1.0.0";
export function buildFrontendMeasurementContract({ startup, sources = [], snapshots = [], generatedAt = null }) {
  const available = snapshots.filter((snapshot) => snapshot.status === "available");
  return Object.freeze({
    contractVersion: FRONTEND_CONTRACT_VERSION,
    startup: Object.freeze({ id: startup.id, name: startup.name, stage: startup.stage, attributionState: startup.attributionState }),
    sources: sources.map((source) => Object.freeze({ id: source.id, label: source.label, deploymentStatus: source.deploymentStatus, attributionState: source.attributionState })),
    metrics: available.map((snapshot) => Object.freeze({ name: snapshot.metricName, value: snapshot.value, unit: snapshot.unit, period: snapshot.period, periodStart: snapshot.periodStart, periodEnd: snapshot.periodEnd, evidenceType: snapshot.evidenceType, sourceId: snapshot.sourceId })),
    empty: available.length === 0,
    emptyReason: available.length === 0 ? "No reproducible production measurement rows have been loaded." : null,
    generatedAt,
    disclaimers: Object.freeze(["Wallets are betting-wallet proxies, not verified human users.", "Current and legacy program results remain separate until cross-program deduplication is validated.", "Betting volume counts qualifying stakes only; payouts and settlements are excluded."]),
  });
}