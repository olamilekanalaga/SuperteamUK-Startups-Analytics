import { ATTRIBUTION_STATE, CHAINS, DEPLOYMENT_STATUS, EVENT_CONFIDENCE, EVENT_TYPE, EVIDENCE_QUALITY, METRIC_STATUS } from "./constants.js";
const iso = (value) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const nonNegative = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
export const SCHEMA_VERSION = "1.0.0";
export const schemaDefinitions = Object.freeze({
  protocolSource: { required: ["startupId", "startupName", "chain", "sourceType", "address", "label", "deploymentStatus", "attributionState", "evidenceQuality"], enums: { chain: Object.values(CHAINS), deploymentStatus: Object.values(DEPLOYMENT_STATUS), attributionState: Object.values(ATTRIBUTION_STATE), evidenceQuality: Object.values(EVIDENCE_QUALITY) } },
  rawTransaction: { required: ["txSignature", "slot", "blockTime", "success", "feePayer", "signers", "programId", "instructions", "sourceMethod", "retrievedAt"] },
  protocolEvent: { required: ["eventId", "startupId", "sourceId", "txSignature", "blockTime", "txSuccess", "wallet", "eventType", "programId", "instructionIndex", "decoderVersion", "confidence"], enums: { eventType: Object.values(EVENT_TYPE), confidence: Object.values(EVENT_CONFIDENCE) } },
  qualifiedWallet: { required: ["startupId", "sourceId", "wallet", "firstSeen", "lastSeen", "transactionCount", "eventCount", "qualifyingBetCount", "activeDays"] },
  metricSnapshot: { required: ["startupId", "sourceId", "metricName", "period", "periodStart", "periodEnd", "status", "unit", "methodologyVersion", "calculatedAt"], enums: { status: Object.values(METRIC_STATUS) } },
});
function validateBase(record, schema, name) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new TypeError(`${name} must be an object`);
  for (const field of schema.required) if (record[field] === undefined || record[field] === null || record[field] === "") throw new TypeError(`${name}.${field} is required`);
  for (const [field, allowed] of Object.entries(schema.enums ?? {})) if (!allowed.includes(record[field])) throw new TypeError(`${name}.${field} must be one of: ${allowed.join(", ")}`);
}
export function validateProtocolSource(record) {
  validateBase(record, schemaDefinitions.protocolSource, "protocolSource");
  if (![record.validFrom, record.validTo].every((value) => value == null || iso(value))) throw new TypeError("protocolSource validity dates must be ISO dates or null");
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...record });
}
export function validateRawTransaction(record) {
  validateBase(record, schemaDefinitions.rawTransaction, "rawTransaction");
  if (!Number.isSafeInteger(record.slot) || record.slot < 0) throw new TypeError("rawTransaction.slot must be a non-negative safe integer");
  if (!iso(record.blockTime) || !iso(record.retrievedAt)) throw new TypeError("rawTransaction timestamps must be ISO dates");
  if (typeof record.success !== "boolean") throw new TypeError("rawTransaction.success must be boolean");
  if (!Array.isArray(record.signers) || !Array.isArray(record.instructions)) throw new TypeError("rawTransaction.signers and instructions must be arrays");
  if (record.fee != null && !nonNegative(record.fee)) throw new TypeError("rawTransaction.fee must be non-negative or null");
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...record });
}
export function validateProtocolEvent(record) {
  validateBase(record, schemaDefinitions.protocolEvent, "protocolEvent");
  if (!iso(record.blockTime)) throw new TypeError("protocolEvent.blockTime must be an ISO date");
  if (typeof record.txSuccess !== "boolean") throw new TypeError("protocolEvent.txSuccess must be boolean");
  if (!Number.isInteger(record.instructionIndex) || record.instructionIndex < 0) throw new TypeError("protocolEvent.instructionIndex must be a non-negative integer");
  if (record.innerInstructionIndex != null && (!Number.isInteger(record.innerInstructionIndex) || record.innerInstructionIndex < 0)) throw new TypeError("protocolEvent.innerInstructionIndex must be a non-negative integer or null");
  for (const field of ["amount", "usdValue"]) if (record[field] != null && !nonNegative(record[field])) throw new TypeError(`protocolEvent.${field} must be non-negative or null`);
  if (record.tokenDecimals != null && (!Number.isInteger(record.tokenDecimals) || record.tokenDecimals < 0)) throw new TypeError("protocolEvent.tokenDecimals must be a non-negative integer or null");
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...record });
}
export function validateQualifiedWallet(record) {
  validateBase(record, schemaDefinitions.qualifiedWallet, "qualifiedWallet");
  if (!iso(record.firstSeen) || !iso(record.lastSeen)) throw new TypeError("qualifiedWallet timestamps must be ISO dates");
  for (const field of ["transactionCount", "eventCount", "qualifyingBetCount", "activeDays"]) if (!Number.isSafeInteger(record[field]) || record[field] < 0) throw new TypeError(`qualifiedWallet.${field} must be a non-negative integer`);
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...record });
}
export function validateMetricSnapshot(record) {
  validateBase(record, schemaDefinitions.metricSnapshot, "metricSnapshot");
  if (![record.periodStart, record.periodEnd, record.calculatedAt].every(iso)) throw new TypeError("metricSnapshot timestamps must be ISO dates");
  if (record.status === METRIC_STATUS.AVAILABLE && !nonNegative(record.value)) throw new TypeError("available metricSnapshot.value must be a non-negative number");
  if (record.status !== METRIC_STATUS.AVAILABLE && record.value !== null) throw new TypeError("unavailable metricSnapshot.value must be null, never zero");
  return Object.freeze({ schemaVersion: SCHEMA_VERSION, ...record });
}