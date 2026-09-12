export const CANONICAL_STAGE = Object.freeze({
  OFFCHAIN: "OFFCHAIN",
  BUILDING: "BUILDING",
  DEVNET: "DEVNET",
  MAINNET: "MAINNET",
  HISTORICAL_MAINNET: "HISTORICAL_MAINNET",
  UNRESOLVED: "UNRESOLVED",
  INACTIVE: "INACTIVE",
});

// Retain all reviewed research while keeping public ecosystem views aligned to
// the currently authenticated Superteam UK directory membership.
export const PUBLIC_DIRECTORY_EXCLUDED_IDS = Object.freeze([
  "STUK-057",
  "STUK-060",
  "STUK-063",
  "STUK-065",
]);

const publicDirectoryExcludedIds = new Set(PUBLIC_DIRECTORY_EXCLUDED_IDS);

export const publicStartupDataset = (startups) => startups.filter((startup) => !publicDirectoryExcludedIds.has(startup.id));

const unverifiedStageById = Object.freeze({
  "STUK-003": CANONICAL_STAGE.OFFCHAIN,
  "STUK-007": CANONICAL_STAGE.BUILDING,
  "STUK-014": CANONICAL_STAGE.OFFCHAIN,
  "STUK-025": CANONICAL_STAGE.UNRESOLVED,
  "STUK-028": CANONICAL_STAGE.BUILDING,
  "STUK-031": CANONICAL_STAGE.UNRESOLVED,
  "STUK-042": CANONICAL_STAGE.UNRESOLVED,
  "STUK-052": CANONICAL_STAGE.UNRESOLVED,
  "STUK-057": CANONICAL_STAGE.BUILDING,
  "STUK-061": CANONICAL_STAGE.UNRESOLVED,
});

const stageByTechnicalState = Object.freeze({
  "Off-chain": CANONICAL_STAGE.OFFCHAIN,
  "Off-chain/Early": CANONICAL_STAGE.OFFCHAIN,
  Infrastructure: CANONICAL_STAGE.OFFCHAIN,
  "Pre-launch": CANONICAL_STAGE.BUILDING,
  "Devnet/testnet": CANONICAL_STAGE.DEVNET,
  Testnet: CANONICAL_STAGE.DEVNET,
  Mainnet: CANONICAL_STAGE.MAINNET,
  "Mainnet infrastructure": CANONICAL_STAGE.MAINNET,
  "Historical mainnet": CANONICAL_STAGE.HISTORICAL_MAINNET,
  Inactive: CANONICAL_STAGE.INACTIVE,
});

export const canonicalStartupStage = (startup) => {
  if (startup.technicalState === "Unverified") return unverifiedStageById[startup.id] ?? CANONICAL_STAGE.UNRESOLVED;
  return stageByTechnicalState[startup.technicalState] ?? CANONICAL_STAGE.UNRESOLVED;
};

export const canonicalStageLabel = Object.freeze({
  [CANONICAL_STAGE.OFFCHAIN]: "Off-chain",
  [CANONICAL_STAGE.BUILDING]: "Building",
  [CANONICAL_STAGE.DEVNET]: "Devnet",
  [CANONICAL_STAGE.MAINNET]: "Mainnet",
  [CANONICAL_STAGE.HISTORICAL_MAINNET]: "Historical Mainnet",
  [CANONICAL_STAGE.UNRESOLVED]: "Unresolved",
  [CANONICAL_STAGE.INACTIVE]: "Inactive",
});

export const canonicalStageTone = Object.freeze({
  [CANONICAL_STAGE.OFFCHAIN]: "offchain",
  [CANONICAL_STAGE.BUILDING]: "prelaunch",
  [CANONICAL_STAGE.DEVNET]: "devnet",
  [CANONICAL_STAGE.MAINNET]: "mainnet",
  [CANONICAL_STAGE.HISTORICAL_MAINNET]: "historical",
  [CANONICAL_STAGE.UNRESOLVED]: "unverified",
  [CANONICAL_STAGE.INACTIVE]: "sunset",
});

export const deriveEcosystemStageCounts = (startups) => {
  const counts = Object.fromEntries(Object.values(CANONICAL_STAGE).map((stage) => [stage, 0]));
  for (const startup of startups) counts[canonicalStartupStage(startup)] += 1;
  return { total: startups.length, ...counts };
};

export const attributionState = (startup) => {
  const entries = startup.technicalEntryPoints ?? [];
  if (!entries.length) return "awaiting_attribution";
  const confirmed = entries.some((entry) => {
    const value = String(entry.attributionStatus ?? "");
    const explicitlyUnconfirmed = /not yet|unconfirmed|candidate|probable|third-party|remains preferable|verification needed|requires? confirmation/iu.test(value);
    return !explicitlyUnconfirmed && /founder-confirmed|official(?:ly)? confirmed|verified attribution/iu.test(value);
  });
  if (confirmed) return "verified";
  return entries.some((entry) => String(entry.address ?? "").trim()) ? "partial" : "unknown";
};