import { buildFrontendMeasurementContract } from "../measurement/frontend-contract.js";
import { calculatePurebetMetrics, createMetricSnapshots } from "../measurement/metrics.js";
import { PUREBET_CONFIG } from "./config.js";
export function runPurebetMeasurement({ eventsBySource = {}, period, calculatedAt }) {
  if (!period?.name || !period?.start || !period?.end) throw new TypeError("period name, start and end are required");
  const outputs = PUREBET_CONFIG.sources.filter((source) => source.sourceType === "program").map((source) => {
    const result = calculatePurebetMetrics(eventsBySource[source.id] ?? []);
    const snapshots = createMetricSnapshots({ startupId: PUREBET_CONFIG.startup.id, sourceId: source.id, period: period.name, periodStart: period.start, periodEnd: period.end, metrics: result.metrics, calculatedAt, methodologyVersion: PUREBET_CONFIG.methodologyVersion });
    return Object.freeze({ sourceId: source.id, ...result, snapshots });
  });
  const snapshots = outputs.flatMap((output) => output.snapshots);
  return Object.freeze({ config: PUREBET_CONFIG, sources: outputs, combined: Object.freeze({ status: "disabled", reason: "Current and legacy remain separate until cross-program deduplication is validated." }), frontend: buildFrontendMeasurementContract({ startup: PUREBET_CONFIG.startup, sources: PUREBET_CONFIG.sources, snapshots, generatedAt: calculatedAt }) });
}