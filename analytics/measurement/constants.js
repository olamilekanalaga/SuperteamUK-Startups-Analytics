export const CHAINS = Object.freeze({ SOLANA: "solana" });
export const DEPLOYMENT_STATUS = Object.freeze({ CURRENT: "current", LEGACY: "legacy", SUPPORTING: "supporting" });
export const ATTRIBUTION_STATE = Object.freeze({ VERIFIED: "verified", PARTIAL: "partial", AWAITING_ATTRIBUTION: "awaiting_attribution" });
export const EVIDENCE_QUALITY = Object.freeze({ OFFICIAL: "official", FOUNDER_CONFIRMED: "founder_confirmed", STRONG_PUBLIC_EVIDENCE: "strong_public_evidence", WEAK_PUBLIC_EVIDENCE: "weak_public_evidence", UNVERIFIED: "unverified" });
export const EVENT_TYPE = Object.freeze({ BET: "bet", SETTLEMENT: "settlement", PAYOUT: "payout", DEPOSIT: "deposit", WITHDRAWAL: "withdrawal", UNKNOWN: "unknown" });
export const EVENT_CONFIDENCE = Object.freeze({ VERIFIED: "verified", HIGH: "high", MEDIUM: "medium", LOW: "low", UNKNOWN: "unknown" });
export const METRIC_STATUS = Object.freeze({ AVAILABLE: "available", PARTIAL: "partial", PENDING: "pending", NOT_AVAILABLE: "not_available", NOT_APPLICABLE: "not_applicable" });