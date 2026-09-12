import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CANONICAL_STAGE, attributionState, canonicalStartupStage, deriveEcosystemStageCounts } from "../src/content/dashboard/startup-stage.js";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const snapshot = JSON.parse(await readFile(new URL("src/data.json", root), "utf8"));
const source = await readFile(new URL("src/content/dashboard/DashboardContent.jsx", root), "utf8");
const css = await readFile(new URL("src/content/dashboard/dashboard.css", root), "utf8");
const theme = await readFile(new URL("src/theme.css", root), "utf8");
const vercel = JSON.parse(await readFile(new URL("vercel.json", root), "utf8"));
const startups = snapshot.queries.researched_startups.rows;
const mainnet = startups.filter((row) => row.queue === "Mainnet Analysis Queue");
const slug = (row) => (row.displayAlias ? `${row.startup}-${row.displayAlias}` : row.currentBrand ? `${row.startup}-${row.currentBrand}` : row.startup)
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const logoKeys = new Set(["logo", "logoPath", "logoSource", "logoSourceUrl", "logoSourceType", "logoVerificationStatus", "logoAuditCategory", "logoAuditSources"]);
const developmentIds = new Set(["STUK-001", "STUK-002", "STUK-004", "STUK-039", "STUK-062"]);
const canonicalRows = startups.slice(0, 43).filter((row) => row.id !== "STUK-008" && row.id !== "STUK-019" && !developmentIds.has(row.id)).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !logoKeys.has(key))));

// Fingerprint of every canonical field before this logo/UI correction.
test("unrelated STUK-001 through STUK-043 records remain byte-stable outside logo metadata", () => {
  const fingerprint = createHash("sha256").update(JSON.stringify(canonicalRows)).digest("hex");
  assert.equal(fingerprint, "a43a7aead6101eb9b20a9238a85e1650a4c5edf35c6aa1f0f926bed898a3574f");
  assert.deepEqual(startups.map((row) => row.id), Array.from({ length: 77 }, (_, i) => `STUK-${String(i + 1).padStart(3, "0")}`));
  assert.equal(new Set(startups.map(slug)).size, 77);
});

test("derived totals reflect the founder-confirmed Xeno off-chain classification", () => {
  const summary = snapshot.queries.research_summary.rows[0];
  assert.equal(summary.directoryStartups, 77);
  assert.equal(startups.length, 77);
  assert.equal(mainnet.length, 35);
  assert.equal(startups.length - mainnet.length, 42);
  assert.equal(77 - startups.length, 0);
  assert.equal(Number(((startups.length / 77) * 100).toFixed(1)), 100);
  assert.deepEqual(summary, { directoryStartups: 77, researched: 77, nonMainnet: 42, mainnetQueue: 35, completionRate: 1 });
});

test("pathname is the source of truth for overview, directory, insights, profiles, invalid slugs, and history", () => {
  for (const route of ['pathname === "/"', 'pathname === "/startups"', 'pathname === "/insights"', "profileSlugFromPath(pathname)"]) assert.ok(source.includes(route), route);
  assert.match(source, /useState\(currentPathname\)/u);
  assert.match(source, /routeFromPathname\(pathname, allStartups\)/u);
  assert.match(source, /addEventListener\("popstate"/u);
  assert.match(source, /history\.pushState/u);
  assert.match(source, /route\.notFound[\s\S]*Startup profile unavailable/u);
  for (const startup of startups) assert.ok(slug(startup));
});

test("Vercel rewrites extensionless SPA routes while leaving asset paths alone", () => {
  assert.deepEqual(vercel.rewrites, [
    { source: "/_data/:path*", destination: "/index.html" },
    { source: "/((?!.*\\.).*)", destination: "/index.html" },
  ]);
});

test("every verified logo is local and resolvable; every fallback is documented", async () => {
  const allowed = new Set(["authenticated-logo", "authenticated-app-icon", "authenticated-favicon", "monogram-identity-unresolved", "monogram-no-downloadable-asset"]);
  for (const startup of startups) {
    assert.ok(allowed.has(startup.logoAuditCategory), `${startup.id} category`);
    assert.equal(startup.logoVerificationStatus, startup.logoAuditCategory);
    assert.ok(Array.isArray(startup.logoAuditSources) && startup.logoAuditSources.length > 0, `${startup.id} audit sources`);
    if (startup.logoPath) {
      assert.match(startup.logoPath, /^\/brands\/startups\/[a-z0-9.-]+$/u);
      assert.equal(startup.logo, startup.logoPath);
      assert.match(startup.logoSource, /^https:\/\//u);
      await access(new URL(`public${startup.logoPath}`, root));
    } else {
      assert.match(startup.logoAuditCategory, /^monogram-/u);
      assert.equal(startup.logo, null);
      assert.equal(startup.logoSource, null);
    }
  }
});

test("unresolved identities never receive unrelated images", () => {
  for (const name of ["Joyplay Ltd", "Yauga", "Pangea"]) {
    const startup = startups.find((row) => row.startup === name);
    assert.ok(startup, name);
    assert.equal(startup.logoPath, null, name);
    assert.equal(startup.logoAuditCategory, "monogram-identity-unresolved", name);
  }
  assert.equal(startups.find((row) => row.startup === "Nexus AI").logoAuditCategory, "monogram-identity-unresolved");
  assert.equal(startups.find((row) => row.startup === "PrimeSkill").logoPath, "/brands/startups/primeskill.webp");
  assert.equal(startups.find((row) => row.startup === "Quantum Street").logoPath, "/brands/startups/quantum-street.webp");
});

test("the common logo component has meaningful alt text, lazy list loading, and finite monogram fallback", () => {
  assert.match(source, /function ProjectLogo/u);
  assert.match(source, /alt=\{`\$\{startup\.startup\} logo`\}/u);
  assert.match(source, /loading=\{profile \? "eager" : "lazy"\}/u);
  assert.match(source, /onError=\{\(\) => setFailed\(true\)\}/u);
  assert.match(source, /showImage = startup\.logoPath && !failed/u);
});

test("directory cards expose identity, stage, description and empty-safe performance slots", () => {
  const card = source.slice(source.indexOf("function StartupCard"), source.indexOf("function HeadlineMetricCard"));
  assert.match(card, /<a className=/u);
  assert.match(card, /href=\{startupPath\(startup\)\}/u);
  assert.match(card, /canonicalStartupStage\(startup\)/u);
  assert.match(card, /industryLabel\(startup\)/u);
  assert.match(card, /cardDescription\(startup\)/u);
  assert.match(card, /startup-card__metrics/u);
  assert.match(card, /metric\?\.value \?\? "—"/u);
  for (const forbidden of ["startup.canonicalFinding", "Data cutoff", "View profile", "startup.id", "SourceLinks"]) assert.ok(!card.includes(forbidden), forbidden);
  assert.match(css, /\.startup-card__description[\s\S]*-webkit-line-clamp:\s*3/u);
  assert.match(css, /@media \(max-width: 800px\)[\s\S]*\.startup-list \{ grid-template-columns: 1fr/u);
});
test("semantic startup-card tokens and classification strips cover every requested state", () => {
  for (const token of ["--startup-card-background", "--startup-card-border", "--startup-card-shadow", "--startup-card-shadow-hover", "--startup-card-title", "--startup-card-description", "--startup-card-tag-background", "--startup-card-tag-border", "--startup-card-focus-ring"]) assert.ok(theme.includes(token), token);
  for (const tone of ["mainnet", "historical", "devnet", "testnet", "offchain", "prelaunch", "sunset", "acquired", "unverified"]) assert.ok(css.includes(`startup-card--${tone}`), tone);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
});

test("overview keeps its 2x2 mobile metric grid and Power BI elevation tokens", () => {
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.metric-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(css, /\.metric-strip > \*[^{}]*\{[^}]*box-shadow:\s*var\(--card-shadow\)/su);
  assert.match(theme, /--card-shadow:/u);
  assert.match(theme, /--card-shadow-hover:/u);
});

test("shared cards remain independent of all six theme implementations", async () => {
  assert.match(source, /useDataApp\(\)/u);
  assert.doesNotMatch(source, /data-app-theme|setAttribute\([^)]*theme/iu);
  assert.equal((await readFile(new URL("src/theme-presets.js", root), "utf8")).match(/\{ id:/gu)?.length, 6);
});

test("STUK-044 through STUK-053 use the existing schema with canonical classifications", () => {
  const expected = [
    ["STUK-044", "cherry.fun", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-045", "Lissen", "Off-chain", "Non-Mainnet Research"],
    ["STUK-046", "Vanish", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-047", "Alpha FC", "Pre-launch", "Non-Mainnet Research"],
    ["STUK-048", "Darklake", "Historical mainnet", "Mainnet Analysis Queue"],
    ["STUK-049", "Seer", "Off-chain/tooling", "Non-Mainnet Research"],
    ["STUK-050", "FairScale", "Mainnet", "Mainnet Analysis Queue"],
    ["STUK-051", "Xeno Money", "Off-chain", "Non-Mainnet Research"],
    ["STUK-052", "Pangea", "Unverified", "Non-Mainnet Research"],
    ["STUK-053", "Altify", "Mainnet/custodial", "Mainnet Analysis Queue"],
  ];
  assert.deepEqual(startups.slice(43, 53).map((row) => [row.id, row.startup, row.classification, row.queue]), expected);
  for (const row of startups.slice(43, 53)) {
    assert.equal(row.lastReviewed, "2026-09-02");
    assert.ok(row.sources.length > 0, row.id);
    for (const key of ["technicalEntryPoints", "completedAnalysis", "outstandingAnalysis", "verifiedMetrics", "projectReportedMetrics", "dataQualityNotes", "sources"]) assert.ok(Array.isArray(row[key]), `${row.id} ${key}`);
  }
});

test("founder-confirmed Xeno is excluded from the mainnet additions", () => {
  assert.deepEqual(startups.slice(43, 53).filter((row) => row.queue === "Mainnet Analysis Queue").map((row) => row.startup), ["cherry.fun", "Vanish", "Darklake", "FairScale", "Altify"]);
});

test("project claims, token cautions, and attribution boundaries remain explicit", () => {
  const lissen = startups.find((row) => row.id === "STUK-045");
  assert.deepEqual(lissen.projectReportedMetrics.map((metric) => metric.value), ["12M+", "80M+", "15K+"]);
  lissen.projectReportedMetrics.forEach((metric) => { assert.match(metric.qualifier, /Project-reported/u); assert.match(metric.sourceUrl, /^https:\/\//u); });
  const darklake = startups.find((row) => row.id === "STUK-048");
  assert.equal(darklake.projectReportedMetrics[0].value, "USD $1.2 million");
  assert.match(darklake.projectReportedMetrics[0].qualifier, /Reported by acquirer/u);
  assert.match(startups.find((row) => row.id === "STUK-050").dataQualityNotes.join(" "), /Do not add.*\$FAIR mint/u);
  assert.match(startups.find((row) => row.id === "STUK-051").dataQualityNotes.join(" "), /no XENO token/u);
  assert.match(startups.find((row) => row.id === "STUK-049").dataQualityNotes.join(" "), /Do not count transactions inspected/u);
  assert.match(startups.find((row) => row.id === "STUK-053").dataQualityNotes.join(" "), /Do not claim customer activity/u);
});

test("new records have unique names/slugs and route through the existing profile system", () => {
  assert.equal(new Set(startups.map((row) => row.startup.toLowerCase())).size, 77);
  assert.equal(new Set(startups.map(slug)).size, 77);
  assert.deepEqual(startups.slice(43, 53).map(slug), ["cherry-fun", "lissen", "vanish", "alpha-fc", "darklake", "seer", "fairscale", "xeno-money", "pangea", "altify"]);
  assert.match(source, /startupPath = \(startup\) => "\/startups\/" \+ startupSlug\(startup\)/u);
});

test("STUK-054 through STUK-066 form the final additive canonical batch", () => {
  const expected = [
    ["STUK-054", "Yield OS", "Mainnet Analysis Queue"],
    ["STUK-055", "Tramplin.io", "Mainnet Analysis Queue"],
    ["STUK-056", "DegenDome", "Mainnet Analysis Queue"],
    ["STUK-057", "Cluck Rush", "Non-Mainnet Research"],
    ["STUK-058", "Soilonic", "Mainnet Analysis Queue"],
    ["STUK-059", "Coldstar", "Non-Mainnet Research"],
    ["STUK-060", "Fitter Circle", "Non-Mainnet Research"],
    ["STUK-061", "Nexus AI", "Non-Mainnet Research"],
    ["STUK-062", "Percolator", "Non-Mainnet Research"],
    ["STUK-063", "Prob Trade", "Mainnet Analysis Queue"],
    ["STUK-064", "MeetSend", "Non-Mainnet Research"],
    ["STUK-065", "Parasol", "Mainnet Analysis Queue"],
    ["STUK-066", "Bonfires.ai", "Mainnet Analysis Queue"],
  ];
  assert.deepEqual(startups.slice(53, 66).map((row) => [row.id, row.startup, row.queue]), expected);
});

test("final batch preserves evidence boundaries and devnet separation", () => {
  assert.equal(startups.find((row) => row.id === "STUK-062").technicalState, "Devnet/testnet");
  assert.equal(startups.find((row) => row.id === "STUK-062").technicalEntryPoints[0].network, "Solana Devnet");
  assert.match(startups.find((row) => row.id === "STUK-054").technicalStatus, /Project-claimed/);
  assert.match(startups.find((row) => row.id === "STUK-058").dataQualityNotes.join(" "), /no mint is canonical/i);
  assert.match(startups.find((row) => row.id === "STUK-066").dataQualityNotes.join(" "), /not proof/i);
  for (const row of startups.slice(53, 66)) {
    assert.equal(row.lastReviewed, "2026-09-02");
    for (const key of ["technicalEntryPoints", "completedAnalysis", "outstandingAnalysis", "verifiedMetrics", "projectReportedMetrics", "dataQualityNotes", "sources"]) assert.ok(Array.isArray(row[key]), row.id + " " + key);
  }
});

test("final batch logos are local or have a documented monogram decision", async () => {
  for (const row of startups.slice(53, 66)) {
    assert.ok(row.logoAuditSources.length > 0, row.id);
    if (row.logoPath) await access(new URL("public" + row.logoPath, root));
    else assert.match(row.logoAuditCategory, /^monogram-/);
  }
  assert.equal(startups.find((row) => row.id === "STUK-061").logoAuditCategory, "monogram-identity-unresolved");
});


test("Cesto and Xeno Money use the authenticated replacement images", async () => {
  const cesto = startups.find((row) => row.startup === "Cesto");
  const xeno = startups.find((row) => row.startup === "Xeno Money");
  assert.equal(cesto.logoPath, "/brands/startups/cesto.png");
  assert.equal(xeno.logoPath, "/brands/startups/xeno-money.png");
  assert.equal(cesto.logoAuditCategory, "authenticated-logo");
  assert.equal(xeno.logoAuditCategory, "authenticated-logo");
  await access(new URL("public" + cesto.logoPath, root));
  await access(new URL("public" + xeno.logoPath, root));
  const authenticated = startups.filter((row) => row.logoPath);
  const monograms = startups.filter((row) => !row.logoPath).map((row) => row.startup);
  assert.equal(authenticated.length, 71);
  assert.deepEqual(monograms, ["Joyplay Ltd", "Yauga", "Pangea", "Nexus AI", "Percolator", "Dominion Silver"]);
});

test("address status labels derive from entry-point attribution and preserve the Purebet candidate address", () => {
  for (const label of [
    "On-chain address needed",
    "Address found - verification needed",
    "Verified address - ready for analysis",
  ]) assert.ok(source.includes(label), label);
  assert.match(source, /technicalEntryPoints/);
  assert.match(source, /attributionStatus/);
  assert.doesNotMatch(source.slice(source.indexOf("function QueueList"), source.indexOf("function InsightsView")), /Ã|â‚¬|â€/u);
  const purebet = startups.find((row) => row.startup === "Purebet");
  const legacyProgram = purebet.technicalEntryPoints.find((entry) => entry.address === "39mBcnQ27QA9nNZmM6VrumE2vtqs5v3HD7t7RGv9kXUV");
  assert.ok(legacyProgram);
  assert.match(legacyProgram.attributionStatus, /not yet official|third-party/i);
  assert.ok(purebet.technicalEntryPoints.some((entry) => entry.address === "9bB3TADcwZEweUUcrp46FEpwMfLbwkEFQnc4patHPApp"));
  assert.match(source, /entryPoint: item\.technicalEntryPoints\?\.\[0\]\?\.address \?\? null/u);
  assert.doesNotMatch(source, /startup\s*===\s*["']Purebet/u);
});

test("unrelated research records and queue membership remain preserved", () => {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(startups.slice(0, 66).filter((row) => row.id !== "STUK-008" && row.id !== "STUK-019" && !developmentIds.has(row.id)).map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !logoKeys.has(key))))))
    .digest("hex");
  assert.equal(fingerprint, "587e0a1d32a16146d97367e42280bca9a5d9c9c5d5297893bd93b38b10b945ed");
  assert.equal(startups.length, 77);
  assert.equal(mainnet.length, 35);
  assert.equal(startups.length - mainnet.length, 42);
});

test("public navigation follows the homepage section model while preserving hidden legacy routes", () => {
  for (const label of ["Home", "Startup Directory", "Ecosystem Impact", "Milestones", "About"]) assert.ok(source.includes(`label: "${label}"`), label);
  assert.match(source, /pathname === "\/insights"/u);
  assert.doesNotMatch(source, /label: "Insights"/u);
  assert.match(source, /className="mobile-app-header"/u);
  assert.match(source, /className="mobile-bottom-nav"/u);
  assert.match(source, /className="mobile-site-menu"/u);
  assert.match(css, /@media \(max-width: 800px\)[\s\S]*\.archive-rail \{ display: none;/u);
});

test("public ecosystem views use the audited 73-startup directory population", async () => {
  const { publicStartupDataset, deriveEcosystemStageCounts } = await import("../src/content/dashboard/startup-stage.js");
  const publicStartups = publicStartupDataset(startups);
  assert.equal(publicStartups.length, 73);
  assert.equal(new Set(publicStartups.map((row) => row.id)).size, 73);
  assert.deepEqual(startups.filter((row) => !publicStartups.includes(row)).map((row) => row.startup), ["Cluck Rush", "Fitter Circle", "Prob Trade", "Parasol"]);
  assert.deepEqual(deriveEcosystemStageCounts(publicStartups), {
    total: 73,
    OFFCHAIN: 22,
    BUILDING: 4,
    DEVNET: 4,
    MAINNET: 30,
    HISTORICAL_MAINNET: 2,
    UNRESOLVED: 10,
    INACTIVE: 1,
  });
  assert.match(source, /routeFromPathname\(pathname, allStartups\)/u);
  assert.match(source, /publicStartupDataset\(allStartups\)/u);
});

test("directory supports approved search, stage and industry filters without changing source records", () => {
  for (const label of ["Search", "Stage", "Industry"]) assert.ok(source.includes(label), label);
  for (const value of ["Off-chain", "Building", "Devnet", "Mainnet", "Growth", "Historical Mainnet", "Unresolved", "Inactive"]) assert.ok(source.includes(value), value);
  assert.match(source, /technical === "Growth" \? hasTrustedPerformance/u);
  assert.match(source, /visibleStartups\.map/u);
});

test("Purebet report uses the supplied verified dashboard data and reusable report modules", () => {
  const purebet = startups.find((row) => row.id === "STUK-008");
  assert.equal(purebet.canonicalFinding, "Purebet demonstrated genuine economic activity, but usage remained small and depended heavily on a small group of high-value wallets.");
  assert.equal(purebet.researchStatus, "Completed");
  assert.equal(purebet.dataCutoff, "2026-03-02");
  assert.deepEqual(purebet.headlineKpis.map((metric) => metric.value), ["49", "1,829", "$363,138.86", "63.27%", "79.95%", "3.17%"]);
  const volume = purebet.reportCharts.find((chart) => chart.id === "monthly-usdc-volume").rows;
  assert.equal(Number(volume.reduce((sum, row) => sum + row.usdcVolume, 0).toFixed(2)), 363138.86);
  assert.deepEqual(volume.map((row) => row.month), ["2025-11", "2025-12", "2026-01", "2026-02", "2026-03"]);
  assert.equal(purebet.reportTables.find((table) => table.id === "program-lifecycle").rows[1].totalTransactions, 8926);
  assert.equal(purebet.reportTables.find((table) => table.id === "migration-summary").rows[0].observedOnBoth, 7);
  assert.match(source, /function ReportKpis/u);
  assert.match(source, /function ReportCharts/u);
  assert.match(source, /function ReportTables/u);
  assert.match(source, /function ReportEvidence/u);
});

test("END Corp verified evidence is preserved and empty filler is removed", () => {
  const end = startups.find((row) => row.id === "STUK-002");
  assert.equal(end.canonicalFinding, "The public climate dashboard is live and updated daily. All verified END Corp program and token addresses were on Solana devnet; no known mainnet address was found.");
  assert.deepEqual(end.metrics.map((metric) => metric.value), ["565", "92.92%", "16,435", "3"]);
  assert.doesNotMatch(source, /Not recorded for this research pass/u);
  assert.match(source, /No attributable mainnet deployment was verified during this research period/u);
});
test("every Devnet or Testnet startup uses the reusable development report schema", () => {
  const development = startups.filter((row) => /devnet|testnet/i.test([row.classification, row.technicalStatus, row.queue].join(" ")));
  assert.deepEqual(development.map((row) => row.id), ["STUK-001", "STUK-002", "STUK-039", "STUK-062"]);
  for (const row of development) {
    assert.equal(row.reportTemplate, "devnet-testnet", row.id);
    assert.equal(row.dataCutoff, "2026-09-02", row.id);
    assert.ok(row.reportNarrative?.whatHappened, row.id + " what happened");
    assert.ok(row.reportNarrative?.whatEvidenceDemonstrates, row.id + " evidence meaning");
    assert.ok(row.reportNarrative?.testingContinuity, row.id + " continuity");
    assert.ok(row.reportNarrative?.superteamImplication, row.id + " implication");
    assert.ok(row.developmentProgress?.length, row.id + " progression");
    assert.ok(row.limitations?.length, row.id + " limitations");
    assert.ok(row.methodologyNotes?.some((note) => note.includes("do not establish customer adoption, commercial usage or revenue")), row.id + " warning");
  }
});

test("development reports conditionally render supported evidence without fake zeroes", () => {
  const prime = startups.find((row) => row.id === "STUK-001");
  const end = startups.find((row) => row.id === "STUK-002");
  const bulk = startups.find((row) => row.id === "STUK-039");
  const percolator = startups.find((row) => row.id === "STUK-062");
  assert.deepEqual(prime.headlineKpis.map((metric) => metric.value), ["443", "91.87%", "440", "6"]);
  assert.deepEqual(end.headlineKpis.map((metric) => metric.value), ["565", "92.92%", "16,435", "3"]);
  assert.equal(bulk.headlineKpis, undefined);
  assert.equal(percolator.headlineKpis, undefined);
  assert.equal(percolator.technicalEntryPoints[0].network, "Solana Devnet");
  assert.match(source, /if \(!metrics\.length\) return null/u);
  assert.match(source, /if \(!startup\.reportCharts\?\.length\) return null/u);
  assert.match(source, /This report measures development and testing activity\. Devnet\/Testnet transactions do not establish customer adoption, commercial usage or revenue\./u);
  assert.doesNotMatch(JSON.stringify([prime, end, bulk, percolator]), /customer count|commercial volume|market share/i);
});

test("Purebet and approved Overview implementation remain unchanged by development reports", () => {
  const purebet = startups.find((row) => row.id === "STUK-008");
  const fingerprint = createHash("sha256").update(JSON.stringify(purebet)).digest("hex");
  assert.equal(fingerprint, "c97a676b2c635f5ed3a281388f04c97d3e91988984f0d35b72ba7ea9e97525a1");
  assert.match(source, /title="Directory universe"/u);
  assert.match(source, /title="Researched"/u);
  assert.match(source, /title="Queue A"/u);
  assert.match(source, /title="Queue B"/u);
  assert.doesNotMatch(source.slice(source.indexOf('view === "overview"'), source.indexOf('view === "archive"')), /DevelopmentNotice|DevelopmentProgress/u);
});

test("mobile menu, continuous reports, contacts, CSV and KPI title fitting use shared authored components", () => {
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/u);
  assert.doesNotMatch(source, /profile-anchors|Summary<|Metrics<|Evidence<|Sources</u);
  assert.match(source, /Download report data · CSV/u);
  assert.match(source, /\["section", "dataset", "date", "entity", "metric", "value", "unit", "evidence_type", "source", "notes"\]/u);
  assert.match(css, /component-title-text[\s\S]*white-space:\s*normal/u);
  assert.match(css, /component-title-text[\s\S]*-webkit-line-clamp:\s*2/u);
  assert.match(css, /box-shadow:\s*6px 7px 0 var\(--analytics-card-depth\)/u);
});

test("researcher-supplied founder contacts remain structured and project links stay separate", () => {
  const expected = {
    "END Corp": [["Founder Telegram", "@andrewjamesrobinson"]],
    "Xeno Money": [["Founder X", "@clive_99"], ["Founder Telegram", "@clive0x123"]],
    "Scrolly": [["Founder X", "@deandev10"], ["Founder Telegram", "@DeanDev10"]],
    "Zynta": [["Founder X", "@onthehouz"], ["Founder Telegram", "@Onthehouz"]],
  };
  for (const [name, contacts] of Object.entries(expected)) {
    const row = startups.find((startup) => startup.startup === name);
    assert.deepEqual(row.founderContacts.map(({ label, handle }) => [label, handle]), contacts);
    row.founderContacts.forEach((contact) => assert.match(contact.url, /^https:\/\/(?:x\.com|t\.me)\//u));
  }
  assert.match(source, /Founder contact/u);
  assert.match(source, /Official project links/u);
  assert.match(source, /target="_blank" rel="noopener noreferrer"/u);
});

test("founder-confirmed END, Xeno and Scrolly conclusions control report rendering", () => {
  const end = startups.find((row) => row.id === "STUK-002");
  const xeno = startups.find((row) => row.id === "STUK-051");
  const scrolly = startups.find((row) => row.id === "STUK-004");
  assert.equal(end.analysisStatus, "Research completed");
  assert.match(end.founderConfirmations.map((item) => item.statement).join(" "), /not live on Solana mainnet/u);
  assert.equal(xeno.classification, "Off-chain");
  assert.match(xeno.canonicalFinding, /not live.*not shipped to the App Store/u);
  assert.equal(xeno.reportCharts, undefined);
  assert.equal(scrolly.classification, "Off-chain");
  assert.match(scrolly.canonicalFinding, /Coinflow.*sunset/u);
  assert.deepEqual(scrolly.projectReportedMetrics.map((metric) => metric.value), ["40,000+", "1.7-1.9 million", "300", "10"]);
});
test("HawkFi completed research uses the shared report schema with founder-confirmed attribution", () => {
  const hawk = startups.find((row) => row.id === "STUK-019");
  assert.equal(hawk.researchStatus, "Completed");
  assert.equal(hawk.chainEvidence, "Founder-confirmed");
  assert.equal(hawk.website, "https://hawkfi.ag");
  assert.deepEqual(hawk.founderContacts.map(({ handle, url }) => [handle, url]), [["@AND__SO", "https://x.com/and__so?s=11"]]);
  const program = hawk.technicalEntryPoints.find((entry) => entry.address === "FqGg2Y1FNxMiGd51Q6UETixQWkF5fB92MysbYogRJb3P");
  assert.equal(program.attributionStatus, "Founder-confirmed");
  assert.equal(program.network, "Solana Mainnet");
  assert.ok(hawk.technicalEntryPoints.some((entry) => entry.address === "HAWK3BVnwptKRFYfVoVGhBc2TYxpyG9jmAbkHeW9tyKE"));
  assert.ok(hawk.technicalEntryPoints.some((entry) => entry.address === "4K3a2ucXiGvuMJMPNneRDyzmNp6i4RdzXJmBdWwGwPEh"));
});

test("HawkFi metrics preserve proxy, derived, verified-priced and pending evidence states", () => {
  const hawk = startups.find((row) => row.id === "STUK-019");
  const activity = hawk.reportTables.find((table) => table.id === "activity-windows").rows;
  assert.deepEqual(activity.map((row) => [row.window, row.activeWallets, row.userSignedTransactions]), [
    ["24H", 75, 741],
    ["7D", 207, 5346],
    ["30D", 511, 29574],
  ]);
  activity.forEach((row) => assert.equal(row.evidenceStatus, "PROXY"));
  assert.deepEqual(hawk.reportTables.find((table) => table.id === "engagement-ratios").rows.map((row) => row.value), ["≈40.5%", "≈14.7%", "≈36.2%"]);
  const fees = hawk.reportTables.find((table) => table.id === "fee-inflows").rows;
  assert.deepEqual(fees.map((row) => row.pricedFeeInflows), ["$465.29", "$2,527.10", "Pending"]);
  assert.match(fees[0].evidenceStatus, /VERIFIED priced subset/u);
  assert.equal(hawk.automationAnalysis.successfulProgramTransactions, 1938285);
  assert.equal(hawk.automationAnalysis.knownAutomationSignerTransactions, 1908392);
  assert.equal(hawk.automationAnalysis.knownAutomationSignerShare, "≈98.46%");
  assert.equal(hawk.volume.status, "pending_methodology");
  assert.equal(hawk.retention.status, "pending_result");
});

test("HawkFi language does not convert proxies or priced subsets into unsupported claims", () => {
  const hawk = startups.find((row) => row.id === "STUK-019");
  const serialized = JSON.stringify(hawk);
  assert.match(hawk.firstObservedActivity.statement, /observable successful on-chain activity dating to 3 May 2022/u);
  assert.doesNotMatch(serialized, /HawkFi launched on 3 May 2022/u);
  assert.match(serialized, /not independently verified human customers/u);
  assert.match(serialized, /not complete audited protocol revenue/u);
  assert.match(serialized, /Underlying Meteora and Orca trading volume must not automatically be attributed to HawkFi/u);
  assert.ok(!hawk.reportTables.some((table) => table.id === "retention-result"));
});

test("Overview KPI cards reuse the theme-aware directory-card depth without changing values", () => {
  assert.match(css, /Overview KPI cards reuse the approved directory-card depth language/u);
  assert.match(css, /\.metric-strip > \* \{[\s\S]*border-top: 5px solid var\(--analytics-card-accent\)/u);
  assert.match(css, /\.metric-strip > \* \{[\s\S]*box-shadow: 5px 6px 0 var\(--analytics-card-depth\)/u);
  assert.match(source, /title="Directory universe" value=\{String\(summary\.directoryStartups\)\}/u);
  assert.match(source, /title="Researched"/u);
  assert.match(source, /title="Queue A"/u);
  assert.match(source, /title="Queue B"/u);
  assert.deepEqual(snapshot.queries.research_summary.rows[0], { directoryStartups: 77, researched: 77, nonMainnet: 42, mainnetQueue: 35, completionRate: 1 });
});
test("canonical startup stages preserve the approved seven-state progression model", () => {
  const counts = deriveEcosystemStageCounts(startups);
  assert.deepEqual(counts, { total: 77, OFFCHAIN: 23, BUILDING: 5, DEVNET: 4, MAINNET: 32, HISTORICAL_MAINNET: 2, UNRESOLVED: 10, INACTIVE: 1 });
  assert.equal(Object.values(counts).slice(1).reduce((sum, count) => sum + count, 0), counts.total);
});

test("approved individually mapped records are not inferred into false stages", () => {
  const expected = { "Home Harvest": CANONICAL_STAGE.OFFCHAIN, Wysdom: CANONICAL_STAGE.OFFCHAIN, "Moon Boi Studios / DD Gaming": CANONICAL_STAGE.BUILDING, "Solistic Technologies": CANONICAL_STAGE.BUILDING, "Cluck Rush": CANONICAL_STAGE.BUILDING, "Joyplay Ltd": CANONICAL_STAGE.UNRESOLVED, "Quantum Street": CANONICAL_STAGE.UNRESOLVED, Yauga: CANONICAL_STAGE.UNRESOLVED, Pangea: CANONICAL_STAGE.UNRESOLVED, "Nexus AI": CANONICAL_STAGE.UNRESOLVED };
  for (const [name, stage] of Object.entries(expected)) assert.equal(canonicalStartupStage(startups.find((startup) => startup.startup === name)), stage, name);
});

test("historical and inactive records remain outside the active technical journey", () => {
  assert.deepEqual(startups.filter((startup) => canonicalStartupStage(startup) === CANONICAL_STAGE.HISTORICAL_MAINNET).map((startup) => startup.startup), ["Rise of the Gorecats", "Darklake"]);
  assert.deepEqual(startups.filter((startup) => canonicalStartupStage(startup) === CANONICAL_STAGE.INACTIVE).map((startup) => startup.startup), ["Signed Trade"]);
});

test("deployment stage remains separate from mainnet attribution confidence", () => {
  const hawk = startups.find((startup) => startup.startup === "HawkFi");
  const agridex = startups.find((startup) => startup.startup === "AgriDex");
  const purebet = startups.find((startup) => startup.startup === "Purebet");
  assert.equal(canonicalStartupStage(hawk), CANONICAL_STAGE.MAINNET);
  assert.equal(attributionState(hawk), "verified");
  assert.equal(canonicalStartupStage(agridex), CANONICAL_STAGE.MAINNET);
  assert.equal(attributionState(agridex), "awaiting_attribution");
  assert.equal(canonicalStartupStage(purebet), CANONICAL_STAGE.MAINNET);
  assert.equal(attributionState(purebet), "partial");
});

test("directory uses canonical counts, journey filters and stage badges in the approved geometry", () => {
  assert.match(source, /deriveEcosystemStageCounts\(startups\)/u);
  assert.match(source, /"All", "Off-chain", "Building", "Devnet", "Mainnet", "Growth", "Historical Mainnet", "Unresolved", "Inactive"/u);
  assert.match(source, /canonicalStageLabel\[canonicalStartupStage\(startup\)\]/u);
  assert.match(source, /function JourneyNavigator/u);
  assert.match(css, /\.startup-list \{ display: grid; grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/u);
});


test("STUK-067 through STUK-077 add the authenticated directory handoff without replacing prior rows", async () => {
  const expected = [
    ["STUK-067", "Rapidscreen", "Off-chain", "Non-Mainnet Research"],
    ["STUK-068", "XPlace", "Unverified", "Mainnet Analysis Queue"],
    ["STUK-069", "Ribh Finance", "Unverified", "Non-Mainnet Research"],
    ["STUK-070", "Dominion Silver", "Mainnet candidate", "Mainnet Analysis Queue"],
    ["STUK-071", "Jade Capital Holdings, Inc.", "Unverified", "Non-Mainnet Research"],
    ["STUK-072", "Reflow Technologies", "Infrastructure", "Non-Mainnet Research"],
    ["STUK-073", "Dr. Fraudsworths' Fantastical Finance Factory", "Mainnet candidate", "Mainnet Analysis Queue"],
    ["STUK-074", "Fabriq", "Infrastructure", "Non-Mainnet Research"],
    ["STUK-075", "The Syndicate", "Identity unresolved", "Non-Mainnet Research"],
    ["STUK-076", "Polaris Data", "Off-chain", "Non-Mainnet Research"],
    ["STUK-077", "Starcap", "Unverified", "Non-Mainnet Research"],
  ];
  assert.deepEqual(startups.slice(66).map((row) => [row.id, row.startup, row.classification, row.queue]), expected);
  assert.deepEqual(startups.slice(0, 66).map((row) => row.id), Array.from({ length: 66 }, (_, i) => `STUK-${String(i + 1).padStart(3, "0")}`));
  for (const row of startups.slice(66)) {
    assert.equal(row.lastReviewed, "2026-09-11", row.id);
    assert.equal(row.metrics.length, 0, row.id);
    assert.equal(row.verifiedMetrics.length, 0, row.id);
    assert.match(row.userEvidence, /Not publicly verifiable/u);
    assert.ok(row.sources.includes("https://superteamuk.org/startup-directory"), row.id);
    if (row.logoPath) await access(new URL("public" + row.logoPath, root));
  }
});

test("new mainnet-candidate identifiers remain typed and repository-documented rather than RPC-verified", () => {
  const dominion = startups.find((row) => row.startup === "Dominion Silver");
  const fraudsworth = startups.find((row) => row.startup.startsWith("Dr. Fraudsworths"));
  assert.equal(dominion.technicalEntryPoints.filter((entry) => entry.type === "Executable program").length, 1);
  assert.equal(dominion.technicalEntryPoints.filter((entry) => entry.type === "Token mint").length, 1);
  assert.equal(fraudsworth.technicalEntryPoints.filter((entry) => entry.type === "Executable program").length, 6);
  assert.equal(fraudsworth.technicalEntryPoints.filter((entry) => entry.type === "Token mint").length, 3);
  for (const entry of [...dominion.technicalEntryPoints, ...fraudsworth.technicalEntryPoints]) {
    assert.match(entry.network, /Solana mainnet-beta/u);
    assert.match(entry.attributionStatus, /not freshly verified via RPC/u);
    assert.ok(entry.source.startsWith("https://github.com/"));
  }
  assert.equal(dominion.logoPath, null);
  assert.equal(dominion.logoAuditCategory, "monogram-no-downloadable-asset");
});

test("new unresolved and infrastructure records preserve attribution boundaries", () => {
  const xplace = startups.find((row) => row.startup === "XPlace");
  const syndicate = startups.find((row) => row.startup === "The Syndicate");
  const starcap = startups.find((row) => row.startup === "Starcap");
  assert.equal(canonicalStartupStage(xplace), CANONICAL_STAGE.UNRESOLVED);
  assert.equal(xplace.queue, "Mainnet Analysis Queue");
  assert.match(xplace.canonicalFinding, /Kamino-wide activity cannot be attributed/u);
  assert.equal(syndicate.website, null);
  assert.equal(syndicate.xAccount, null);
  assert.equal(canonicalStartupStage(syndicate), CANONICAL_STAGE.UNRESOLVED);
  assert.equal(starcap.otherChainLead.address, "0x8d1612b4b78ebf08cfbf01a04fa270ccbb0509a2");
  assert.match(starcap.canonicalFinding, /rather than proof of a Solana deployment/u);
});
